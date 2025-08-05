'use client';

import { FC } from 'react';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const LogoutButton: FC = () => {
  const router = useRouter();

  const handleLogout = async () => {
    const response = await fetch(`/api/auth/logout`, { method: 'POST' });
    if (response.ok) {
      router.replace('/');
    }
  };
  return (
    <Button variant="outline" onClick={handleLogout}>
      <LogOut className="w-4 h-4 mr-2" />
      Logout
    </Button>
  );
};
