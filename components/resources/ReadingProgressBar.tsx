'use client';

import React, { useEffect, useState } from 'react';

export default function ReadingProgressBar() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const totalScrollable = documentHeight - windowHeight;
      if (totalScrollable <= 0) {
        setWidth(0);
        return;
      }
      
      const percentage = (scrollY / totalScrollable) * 100;
      setWidth(percentage);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-zinc-100 z-50 select-none">
      <div 
        style={{ width: `${width}%` }} 
        className="h-full bg-[#22577A] transition-all duration-75 ease-out" 
      />
    </div>
  );
}
