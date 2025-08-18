import Image from 'next/image';
import { LogoutButton } from './logout';
import { FC } from 'react';

export const Header: FC<{ max?: boolean }> = ({ max }) => {
  return (
    <header className="bg-white border-b">
      <div className={`${max ? 'max-w-7xl' : ''} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <Image
              src="/EENlogo.jpeg"
              alt="EEN Multitech Logo"
              width={32}
              height={32}
              className="object-contain"
            />
            <h1 className="text-2xl font-bold text-gray-900">EEN Multitech</h1>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
};
