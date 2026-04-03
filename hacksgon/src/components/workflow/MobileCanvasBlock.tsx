import React, { useEffect, useState } from 'react';
import { Monitor, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface MobileCanvasBlockProps {
  backUrl: string;
}

export function MobileCanvasBlock({ backUrl }: MobileCanvasBlockProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkSize = () => {
      setIsMobile(window.innerWidth < 1024); // Workflow canvas is heavy, 1024px (tablet/laptop) is a safe cutoff
    };
    
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  if (!mounted || !isMobile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
    >
      <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <Monitor className="w-10 h-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-foreground">Desktop Only Experience</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Designing workflows and interacting with the canvas requires a larger screen for precision and the best experience. 
          </p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3 text-left border border-border/50">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
             <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            Mobile editing is temporarily disabled to prevent accidental changes to your automation logic.
          </p>
        </div>

        <Button asChild className="w-full h-12 rounded-xl text-sm font-bold gap-2">
          <Link href={backUrl}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </Button>
        
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/40 pt-2">
          MediQueue Pro · Advanced Automation
        </p>
      </div>
    </motion.div>
  );
}
