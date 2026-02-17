'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  className
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = currentPage * itemsPerPage + 1;
  const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems);

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-between border-t border-border pt-3', className)}>
      <span className="text-xs text-foreground-muted tabular-nums">
        {startItem}–{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-all',
            canGoPrev
              ? 'text-foreground hover:bg-primary-muted hover:text-primary hover:shadow-neon-glow-primary-xs cursor-pointer'
              : 'text-foreground-muted cursor-not-allowed opacity-40'
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium text-primary bg-primary/10 tabular-nums">
          {currentPage + 1}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-all',
            canGoNext
              ? 'text-foreground hover:bg-primary-muted hover:text-primary hover:shadow-neon-glow-primary-xs cursor-pointer'
              : 'text-foreground-muted cursor-not-allowed opacity-40'
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
