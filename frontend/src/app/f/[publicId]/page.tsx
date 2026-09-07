import { Respondent } from '../../../components/Respondent';

export default async function PublicPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <Respondent publicId={publicId} />;
}
