import { Results } from '../../../../components/Results';
export default async function ResultsPage({params}:{params:Promise<{formId:string}>}) {
  const {formId}=await params;
  return <Results formId={formId}/>;
}
