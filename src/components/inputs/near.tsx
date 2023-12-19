import { formatNearAmount } from "near-api-js/lib/utils/format";
import {
  type FieldPath,
  type FieldValues,
  type UseControllerProps,
} from "react-hook-form";
import { type InputProps } from "~/lib/validation/inputs";
import { Button } from "../ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

export function NearWithMaxInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: UseControllerProps<TFieldValues, TName> &
    InputProps & { yoctoMax: string },
) {
  return (
    <FormField
      {...props}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="capitalize">
            {props.label ?? field.name}
            {props.rules?.required && " *"}
          </FormLabel>
          <FormControl>
            <div className="flex flex-row">
              <Input
                {...field}
                placeholder={props.placeholder}
                type="text"
                className="rounded-r-none"
              />
              <Button
                type="button"
                className="rounded-l-none"
                onClick={() => {
                  field.onChange(
                    formatNearAmount(props.yoctoMax).replaceAll(",", ""),
                  );
                }}
              >
                <div className="inline-flex items-center">Max</div>
              </Button>
            </div>
          </FormControl>
          <FormDescription>{props.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}