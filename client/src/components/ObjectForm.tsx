import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Object, insertObjectSchema } from "db/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DynamicFields from "./DynamicFields";
import { useToast } from "@/hooks/use-toast";

interface ObjectFormProps {
  object?: Object | null;
  onSave: () => void;
  onCancel: () => void;
}

const DEFAULT_FIELDS_BY_TYPE = {
  Contact: {
    email: { type: "email", label: "Email Address" },
    phone: { type: "phone", label: "Phone Number" }
  },
  Lead: {
    email: { type: "email", label: "Email Address" },
    phone: { type: "phone", label: "Phone Number" },
    company: { type: "text", label: "Company" },
    status: { type: "text", label: "Status" }
  },
  Company: {
    website: { type: "url", label: "Website" },
    industry: { type: "text", label: "Industry" }
  },
  Project: {
    startDate: { type: "date", label: "Start Date" },
    status: { type: "text", label: "Project Status" }
  },
  Task: {
    dueDate: { type: "date", label: "Due Date" },
    priority: { type: "text", label: "Priority" },
    status: { type: "text", label: "Status" }
  }
};

export default function ObjectForm({ object, onSave, onCancel }: ObjectFormProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertObjectSchema),
    defaultValues: object || {
      name: "",
      type: "Contact",
      description: "",
      fields: DEFAULT_FIELDS_BY_TYPE["Contact"]
    }
  });

  const onSubmit = async (data: Object) => {
    if (!data.type?.trim()) {
      toast({
        title: "Error",
        description: "Type is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // The server will automatically set companyId and createdBy from the authenticated user
      const response = await fetch(`/api/objects${object ? `/${object.id}` : ""}`, {
        method: object ? "PUT" : "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create object');
      }

      toast({
        title: "Success",
        description: `Object ${object ? "updated" : "created"} successfully`,
      });
      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTypeChange = (value: string) => {
    // Update fields based on selected type
    const newFields = DEFAULT_FIELDS_BY_TYPE[value as keyof typeof DEFAULT_FIELDS_BY_TYPE] || {};
    form.setValue("fields", newFields);
    form.setValue("type", value);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type *</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  required
                  onChange={(e) => handleTypeChange(e.target.value)}
                />
              </FormControl>
              <p className="text-sm text-muted-foreground">
                Suggested types: Contact, Lead, Company, Project, Task
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fields"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Fields</FormLabel>
              <FormControl>
                <DynamicFields {...field} control={form.control} name="fields" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {object ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
