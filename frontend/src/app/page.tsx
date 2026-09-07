import { Builder } from '../components/Builder';
import { Dashboard } from '../components/Dashboard';
export default async function Home({searchParams}:{searchParams:Promise<{form?:string}>}) {
  const {form}=await searchParams;
  return form ? <Builder/> : <Dashboard/>;
}
