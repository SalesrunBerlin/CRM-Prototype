import { useState } from "react";
import { Control, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DynamicFieldsProps {
  control: Control<any>;
  name: string;
}

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "email",
  "phone",
  "url",
];

export default function DynamicFields({ control, name }: DynamicFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const addField = () => {
    append({ key: "", type: "text", label: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Custom Fields</h3>
        <Button type="button" onClick={addField} variant="outline">
          Add Field
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            placeholder="Field name"
            {...control.register(`${name}.${index}.key`)}
          />
          <Select
            value={field.type}
            onValueChange={(value) => control.setValue(`${name}.${index}.type`, value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Field type" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Label"
            {...control.register(`${name}.${index}.label`)}
          />
          <Button
            type="button"
            variant="destructive"
            onClick={() => remove(index)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
