'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Custom Caption component with year and month dropdowns
function CustomCaption({
  displayMonth,
  onMonthChange,
}: {
  displayMonth: Date;
  onMonthChange: (month: Date) => void;
}) {
  const currentYear = displayMonth.getFullYear();
  const currentMonth = displayMonth.getMonth();

  // Generate year options (current year ± 100 years)
  const yearOptions = Array.from({ length: 201 }, (_, i) => currentYear - 100 + i);

  // Month names
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handleYearChange = (year: string) => {
    const newDate = new Date(parseInt(year), currentMonth, 1);
    onMonthChange(newDate);
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentYear, parseInt(month), 1);
    onMonthChange(newDate);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    onMonthChange(newDate);
  };

  return (
    <div className="flex justify-between items-center pt-1 relative">
      <button
        type="button"
        onClick={goToPreviousMonth}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1'
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[120px] h-8 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((month, index) => (
              <SelectItem key={index} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[80px] h-8 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {yearOptions.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={goToNextMonth}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1'
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || new Date());

  const handleMonthChange = (newMonth: Date) => {
    setMonth(newMonth);
    if (props.onMonthChange) {
      props.onMonthChange(newMonth);
    }
  };

  return (
    <DayPicker
      month={month}
      onMonthChange={handleMonthChange}
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside:
          'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Caption: ({ displayMonth }) => (
          <CustomCaption displayMonth={displayMonth} onMonthChange={handleMonthChange} />
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
