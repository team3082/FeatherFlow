"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/ProjectStore';
import Header from '@/components/layout/Header';
import Footer from './components/Footer';
import { LeftSidebar } from './components/left_sidebar/LeftSidebar';
import RightSidebar from './components/right_sidebar/RightSidebar';
import { Field } from './components/Field';

export default function Studio() {
  const router = useRouter();
  const isProjectLoaded = useProjectStore(state => state.isProjectLoaded);

  useEffect(() => {
    if (!isProjectLoaded) {
      router.push('/');
    }
  }, [isProjectLoaded, router]);

  if (!isProjectLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <Field />
        <RightSidebar />
      </main>
      <Footer />
    </div>
  );
}