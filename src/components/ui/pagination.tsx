import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants, ButtonProps } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Subcomponents for granular usage (shadcn compatible)
const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'button'>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <button
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'default' : 'outline',
        size,
      }),
      'h-8 w-8 text-xs font-medium transition-all',
      isActive && 'shadow-sm font-semibold pointer-events-none',
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="sm"
    className={cn('gap-1 px-2.5 h-8 text-xs font-normal', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span className="hidden sm:inline">Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="sm"
    className={cn('gap-1 px-2.5 h-8 text-xs font-normal', className)}
    {...props}
  >
    <span className="hidden sm:inline">Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-8 w-8 items-center justify-center text-muted-foreground', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

// All-in-one Complete Pagination Component
export interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  itemLabel?: string;
  showPageSizeSelector?: boolean;
  showItemCount?: boolean;
  showFirstLast?: boolean;
  disabled?: boolean;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
  itemLabel = 'items',
  showPageSizeSelector = true,
  showItemCount = true,
  showFirstLast = true,
  disabled = false,
}) => {
  // If no pages or only 1 page and no item count needed, still render controls cleanly if desired
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  // Compute item count range (e.g., Showing 1-10 of 42)
  const startItem = totalItems !== undefined && pageSize !== undefined
    ? totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
    : undefined;
  const endItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min(safeCurrentPage * pageSize, totalItems)
    : undefined;

  // Generate page numbers with smart ellipsis: [1, '...', 4, 5, 6, '...', 20]
  const getPageNumbers = (): (number | string)[] => {
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    const showLeftEllipsis = safeCurrentPage > 4;
    const showRightEllipsis = safeCurrentPage < safeTotalPages - 3;

    pages.push(1);

    if (showLeftEllipsis) {
      pages.push('ellipsis-left');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    } else {
      for (let i = 2; i <= 4; i++) {
        pages.push(i);
      }
    }

    if (showRightEllipsis) {
      pages.push('ellipsis-right');
    } else if (showLeftEllipsis) {
      const start = Math.max(2, safeTotalPages - 3);
      for (let i = start; i < safeTotalPages; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
    }

    if (!pages.includes(safeTotalPages)) {
      pages.push(safeTotalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-border/60 text-xs sm:text-sm text-muted-foreground w-full select-none',
        className
      )}
    >
      {/* Left side: Item Count & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 justify-center sm:justify-start w-full sm:w-auto">
        {showItemCount && totalItems !== undefined && (
          <span className="font-normal text-muted-foreground">
            {totalItems === 0 ? (
              'No records found'
            ) : startItem !== undefined && endItem !== undefined ? (
              <>
                Showing <strong className="font-semibold text-foreground">{startItem}</strong>-
                <strong className="font-semibold text-foreground">{endItem}</strong> of{' '}
                <strong className="font-semibold text-foreground">{totalItems}</strong> {itemLabel}
              </>
            ) : (
              <>
                Total <strong className="font-semibold text-foreground">{totalItems}</strong> {itemLabel}
              </>
            )}
          </span>
        )}

        {showPageSizeSelector && onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-[68px] text-xs px-2 bg-background border-input">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent side="top" align="start">
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right side: Numbered Pagination Controls */}
      <div className="flex items-center gap-1 justify-center sm:justify-end w-full sm:w-auto">
        {showFirstLast && safeTotalPages > 4 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage === 1 || disabled}
            aria-label="First page"
            className="h-8 w-8 text-xs hidden sm:inline-flex"
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || disabled}
          aria-label="Previous page"
          className="h-8 px-2 sm:px-2.5 text-xs gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`${p}-${idx}`}
                  className="flex h-8 w-6 sm:w-8 items-center justify-center text-muted-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <Button
                key={p}
                variant={isCurrent ? 'default' : 'outline'}
                size="icon"
                onClick={() => onPageChange(p)}
                disabled={disabled}
                className={cn(
                  'h-8 w-8 text-xs transition-all',
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-foreground hover:bg-muted'
                )}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages || disabled}
          aria-label="Next page"
          className="h-8 px-2 sm:px-2.5 text-xs gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {showFirstLast && safeTotalPages > 4 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={safeCurrentPage === safeTotalPages || disabled}
            aria-label="Last page"
            className="h-8 w-8 text-xs hidden sm:inline-flex"
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
