"""Explicit, insert-only demo seeding. Run from backend/: python -m app.seed."""
import json
from uuid import UUID, uuid5

from .database import database_path, make_engine, make_session_factory
from .migrations import migrate
from .models import Form, Publication
from .publication import publish_in_session, submit_in_session, SubmissionInput
from .schemas import DraftInput

# Fixed namespace and semantic keys are the identity contract, independent of titles.
NAMESPACE = UUID('1d63d908-45c7-4df9-a431-88d5114fd876')


def seed_id(key):
    return str(uuid5(NAMESPACE, 'typeform-demo-v1/' + key))


def fixtures():
    """Five fictional respondents per form; choice answers use labels until encoded."""
    return [
        {
            'key': 'event-registration', 'title': 'Event Registration',
            'questions': [
                ('name', 'short_text', 'What is your name?', 'Tell us what to put on your event badge.', True, []),
                ('email', 'email', 'Where should we send your confirmation?', 'Use an email address you can check before the event.', True, []),
                ('session', 'dropdown', 'Which workshop would you like to attend?', 'Choose one afternoon workshop.', True, ['Accessible design', 'Building APIs', 'Product discovery']),
                ('guests', 'number', 'How many guests are joining you?', 'Enter 0 if you are attending on your own.', True, []),
                ('updates', 'yes_no', 'Would you like updates about future events?', 'Your choice does not affect your registration.', True, []),
                ('access', 'long_text', 'Is there anything we can do to help you attend?', 'Optional: share accessibility or dietary requests.', False, []),
            ],
            'rows': [
                ['Avery Reed', 'avery.reed@example.com', 'Accessible design', 0, False, None],
                ['Morgan Ellis', 'morgan.ellis@example.com', 'Building APIs', 1, True, 'Please provide a vegetarian lunch.'],
                ['Casey Rowan', 'casey.rowan@example.com', 'Product discovery', 2, True, None],
                ['Jordan Vale', 'jordan.vale@example.com', 'Building APIs', 0, False, 'Step-free access would be helpful.'],
                ['Taylor Quinn', 'taylor.quinn@example.com', 'Accessible design', 1, True, 'Please share slides after the workshop.'],
            ],
        },
        {
            'key': 'product-feedback', 'title': 'Product Feedback',
            'questions': [
                ('rating', 'rating', 'How would you rate your experience?', 'Choose from 1 (poor) to 5 (excellent).', True, []),
                ('feature', 'multiple_choice', 'Which feature helps you most?', 'Choose the feature you use most often.', True, ['Form builder', 'Public forms', 'Response results']),
                ('recommend', 'yes_no', 'Would you recommend this product?', 'An honest No is just as useful as a Yes.', True, []),
                ('hours', 'number', 'How many hours did it save you this week?', 'An estimate is fine; enter 0 if it has not saved time yet.', True, []),
                ('improve', 'long_text', 'What should we improve next?', 'Optional: describe a problem or a useful improvement.', False, []),
                ('email', 'email', 'May we contact you about your feedback?', 'Optional: leave an email address for a follow-up.', False, []),
            ],
            'rows': [
                [5, 'Form builder', True, 2, 'More keyboard shortcuts would help.', 'avery.reed@example.com'],
                [4, 'Public forms', True, 1, None, None],
                [2, 'Response results', False, 0, 'I would like to export responses.', 'casey.rowan@example.com'],
                [4, 'Form builder', True, 3, 'Please add more theme choices.', None],
                [3, 'Response results', False, 0, 'A clearer version selector would help.', 'taylor.quinn@example.com'],
            ],
        },
    ]


def draft_for(fixture):
    key = fixture['key']
    return DraftInput.model_validate({
        'title': fixture['title'],
        'questions': [
            {'id': seed_id(f'{key}/question/{name}'), 'type': kind, 'prompt': prompt,
             'description': description, 'required': required,
             'options': [{'id': seed_id(f'{key}/question/{name}/option/{i}'), 'label': label}
                         for i, label in enumerate(labels)]}
            for name, kind, prompt, description, required, labels in fixture['questions']
        ],
    })


def seed_demo(path):
    engine = make_engine(path)
    try:
        migrate(engine, path)
        results = []
        # One lock covers existence checks and both forms, snapshots and all responses.
        with make_session_factory(engine).begin() as session:
            session.connection().exec_driver_sql('BEGIN IMMEDIATE')
            for fixture in fixtures():
                key = fixture['key']
                form_id = seed_id(key + '/form')
                if session.get(Form, form_id) is not None:
                    publication = session.get(Publication, form_id)
                    results.append({'form_id': form_id, 'status': 'skipped-existing',
                                    'public_id': publication.public_id if publication else None})
                    continue
                draft = draft_for(fixture)
                version_id = seed_id(key + '/version/1')
                publish_in_session(session, form_id, draft, version_id=version_id)
                publication = session.get(Publication, form_id)
                publication.public_id = seed_id(key + '/public')
                session.flush()
                for i, row in enumerate(fixture['rows']):
                    if len(row) != len(draft.questions):
                        raise ValueError('Seed row must match the question count.')
                    answers = []
                    for question, value in zip(draft.questions, row):
                        if value is None:
                            continue
                        if question.type in {'multiple_choice', 'dropdown'}:
                            value = str(next(option.id for option in question.options if option.label == value))
                        answers.append({'question_id': question.id, 'value': value})
                    body = SubmissionInput.model_validate({
                        'submission_id': seed_id(f'{key}/submission/{i + 1}'),
                        'version_id': version_id, 'answers': answers,
                    })
                    submit_in_session(session, UUID(publication.public_id), body)
                results.append({'form_id': form_id, 'status': 'created', 'public_id': publication.public_id})
        return results
    finally:
        engine.dispose()


def main():
    path = database_path()
    results = seed_demo(path)
    print(json.dumps({'database': str(path), 'forms': results}, indent=2))


if __name__ == '__main__':
    main()
