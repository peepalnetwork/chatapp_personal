import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import UserManagement from '@/components/admin/user-management';
import { SettingsComponent } from '@/components/admin/SettingsComponent';
import { Header } from '@/components/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatManagement from '@/components/admin/chat-management';

export default async function AdminPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');

  if (!token) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header max />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SettingsComponent />
        </div>
        <Tabs defaultValue="UserManagement">
          <TabsList>
            <TabsTrigger value="UserManagement">User Management</TabsTrigger>
            <TabsTrigger value="ChatManagement">Chat Management</TabsTrigger>
          </TabsList>
          <TabsContent value="UserManagement">
            <UserManagement />
          </TabsContent>
          <TabsContent value="ChatManagement">
            <ChatManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
