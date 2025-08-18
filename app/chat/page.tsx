import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ChatInterface from '@/components/chat/chat-interface';
import { LogoutButton } from '@/components/logout';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/header';

export default async function ChatPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');

  if (!token) {
    redirect('/');
  }
  const currentUser = await getCurrentUser(undefined, token.value);
  if (!currentUser) redirect('/');

  return (
    <div className="h-screen flex flex-col">
      <Header />
      {/* THIS is the fix: Use flex-1, not h-full or overflow-scroll */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface currentUser={currentUser} />
      </main>
    </div>
  );
}
