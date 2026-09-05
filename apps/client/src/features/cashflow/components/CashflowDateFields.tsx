import { type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

const toLocalInput = (input: string | Date) => {
  const date = input instanceof Date ? input : new Date(input);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const defaultDateTimeValue = () => toLocalInput(new Date());
const timePresets = [
  { label: "Now", minutes: 0 },
  { label: "-1w", minutes: -10080 },
];

type Props = {
  control: Control<CashflowQuickAddValues>;
};

export function CashflowDateFields({ control }: Props) {
  return (
    <FormField
      control={control}
      name="transaction_time"
      render={({ field }) => {
        const nowLocal = defaultDateTimeValue();
        const adjustMinutes = (minutes: number) => {
          const base = field.value ? new Date(field.value) : new Date();
          base.setMinutes(base.getMinutes() + minutes);
          const now = new Date();
          const clamped = base > now ? now : base;
          field.onChange(toLocalInput(clamped));
        };

        return (
          <FormItem>
            <FormLabel className="text-sm font-semibold">Transaction time</FormLabel>
            <FormControl>
              <div className="space-y-2 rounded-xl border bg-white/70 p-3 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => {
                    const presetDate = new Date();
                    presetDate.setMinutes(presetDate.getMinutes() + preset.minutes);
                    const presetInput = toLocalInput(presetDate);
                    const isActive = field.value && Math.abs(new Date(field.value).getTime() - presetDate.getTime()) < 60 * 1000;
                    return (
                      <Button
                        key={preset.label}
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className={`rounded-full px-3 ${isActive ? "bg-foreground text-white hover:bg-foreground" : "bg-white"}`}
                        onClick={() => field.onChange(presetInput)}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full px-3" onClick={() => adjustMinutes(-1440)}>
                      -1d
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-full px-3" onClick={() => adjustMinutes(1440)}>
                      +1d
                    </Button>
                  </div>
                </div>
                <Input
                  type="datetime-local"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = val ? new Date(val) : null;
                    const now = new Date();
                    if (parsed && parsed > now) {
                      field.onChange(toLocalInput(now));
                      return;
                    }
                    field.onChange(val);
                  }}
                  max={nowLocal}
                  placeholder="Now by default"
                />
              </div>
            </FormControl>
            <FormMessage>{(control._formState.errors as any)?.transaction_time?.message}</FormMessage>
          </FormItem>
        );
      }}
    />
  );
}
