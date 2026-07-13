import React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (val: string) => void;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ onSearch, className, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", className)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          ref={ref}
          type="search"
          onChange={(e) => {
            props.onChange?.(e);
            onSearch?.(e.target.value);
          }}
          className="pl-9 h-9 text-xs font-semibold border-zinc-200 rounded-xl focus-visible:ring-accent w-full text-zinc-800 placeholder:text-zinc-400 bg-white"
          {...props}
        />
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
