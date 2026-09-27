import { useState } from "react";
import { type Control, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";
import { Calendar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const toLocalInput = (input: string | Date) => {
  const date = input instanceof Date ? input : new Date(input);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
};

const defaultDateTimeValue = () => toLocalInput(new Date());

type Props = {
  control: Control<CashflowQuickAddValues>;
};

export function CashflowDateFields({ control }: Props) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const transactionTime = useWatch({ control, name: "transaction_time" });

  const isNow =
    !transactionTime ||
    Math.abs(new Date(transactionTime).getTime() - Date.now()) < 5 * 60 * 1000;


  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const isYesterday = Boolean(
    transactionTime &&
      new Date(transactionTime).toDateString() === yesterdayDate.toDateString()
  );

  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const isLastWeek = Boolean(
    transactionTime &&
      new Date(transactionTime).toDateString() === lastWeekDate.toDateString()
  );

  return (
    <FormField
      control={control}
      name="transaction_time"
      render={({ field }) => {
        const setNow = () => {
          field.onChange(defaultDateTimeValue());
          setShowCustomPicker(false);
        };


        const setYesterday = () => {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          field.onChange(toLocalInput(y));
          setShowCustomPicker(false);
        };

        const setLastWeek = () => {
          const lw = new Date();
          lw.setDate(lw.getDate() - 7);
          field.onChange(toLocalInput(lw));
          setShowCustomPicker(false);
        };

        return (
          <FormItem className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FormLabel className="text-xs font-semibold text-slate-700">Thời gian</FormLabel>
              {field.value && (
                <span className="text-[11px] text-muted-foreground">
                  {new Date(field.value).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <FormControl>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={isNow && !showCustomPicker ? "default" : "outline"}
                    className={cn(
                      "h-8 rounded-xl px-2.5 text-xs gap-1 font-medium transition-all active:scale-95",
                      isNow && !showCustomPicker
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    )}
                    onClick={setNow}
                  >
                    <Zap className="h-3 w-3" />
                    Bây giờ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isLastWeek && !showCustomPicker ? "default" : "outline"}
                    className={cn(
                      "h-8 rounded-xl px-2.5 text-xs font-medium transition-all active:scale-95",
                      isLastWeek && !showCustomPicker
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    )}
                    onClick={setLastWeek}
                  >
                    Tuần trước
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isYesterday && !showCustomPicker ? "default" : "outline"}
                    className={cn(
                      "h-8 rounded-xl px-2.5 text-xs font-medium transition-all active:scale-95",
                      isYesterday && !showCustomPicker
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    )}
                    onClick={setYesterday}
                  >
                    Hôm qua
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={showCustomPicker ? "default" : "outline"}
                    className={cn(
                      "h-8 rounded-xl px-2.5 text-xs gap-1 font-medium transition-all active:scale-95",
                      showCustomPicker
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    )}
                    onClick={() => setShowCustomPicker((v) => !v)}
                  >
                    <Calendar className="h-3 w-3" />
                    {showCustomPicker ? "Đóng lịch" : "Khác..."}
                  </Button>
                </div>

                {showCustomPicker && (
                  <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <Input
                      type="datetime-local"
                      step="1"
                      className="h-9 rounded-xl text-xs bg-white border-slate-200"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val);
                      }}
                      max={defaultDateTimeValue()}
                    />
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage className="text-xs text-rose-500 font-medium">
              {(control._formState.errors as any)?.transaction_time?.message}
            </FormMessage>
          </FormItem>
        );
      }}
    />
  );
}
