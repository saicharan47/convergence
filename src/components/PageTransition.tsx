import React from 'react';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex-1 flex flex-col w-full h-full"
    >
      {children}
    </motion.div>
  );
}
