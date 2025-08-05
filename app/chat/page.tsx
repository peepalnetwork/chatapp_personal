import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ChatInterface from '@/components/chat/chat-interface';
import { LogoutButton } from '@/components/logout';
import { getCurrentUser } from '@/lib/auth';

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
      <header className="bg-white border-b px-4 py-2 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chat System</h1>
        <LogoutButton />
      </header>
      <div className="flex-1">
        <ChatInterface currentUser={currentUser} />
      </div>
    </div>
  );
}
