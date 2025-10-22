"use client";

import { Field } from '@/app/studio/components/Field';
import Header from '@/components/layout/Header';
import Footer from '../studio/components/Footer';
import { LeftSidebar } from '../studio/components/left_sidebar/LeftSidebar';
import RightSidebar from '../studio/components/right_sidebar/RightSidebar';

export default function Studio() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <Field />
        <RightSidebar />
      </div>
      <Footer />
    </div>
  );
}