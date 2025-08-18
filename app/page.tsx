import LoginForm from '@/components/login-form';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');

  if (token) {
    const user = await getCurrentUser(undefined, token.value);
    if (user?.role === 'admin') return redirect('/admin');
    return redirect('/chat');
  }
  return <LoginForm />;
}
