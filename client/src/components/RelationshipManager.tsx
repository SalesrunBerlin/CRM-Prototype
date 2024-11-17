import { useState, useEffect } from "react";
import useSWR from "swr";
import { ObjectRelation, type Object } from "db/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface RelationshipManagerProps {
  objectId: number;
}

const RELATION_TYPES = [
  "Parent",
  "Child",
  "Related",
  "Reference",
];

export default function RelationshipManager({ objectId }: RelationshipManagerProps) {
  const { data: objects } = useSWR<Object[]>("/api/objects");
  const { data: relations, mutate: mutateRelations } = useSWR<ObjectRelation[]>(
    `/api/objects/${objectId}/relations`
  );
  const { toast } = useToast();
  const [selectedObject, setSelectedObject] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("Related");

  const handleAddRelation = async () => {
    if (!selectedObject) {
      toast({
        title: "Error",
        description: "Please select an object to relate to",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/objects/${objectId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: parseInt(selectedObject),
          type: selectedType,
        }),
      });

      if (!response.ok) throw new Error("Failed to create relation");

      await mutateRelations();
      toast({
        title: "Success",
        description: "Relation created successfully",
      });
      setSelectedObject("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveRelation = async (relationId: number) => {
    try {
      const response = await fetch(
        `/api/objects/${objectId}/relations/${relationId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove relation");

      await mutateRelations();
      toast({
        title: "Success",
        description: "Relation removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedObject} onValueChange={setSelectedObject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select object" />
          </SelectTrigger>
          <SelectContent>
            {objects
              ?.filter((obj) => obj.id !== objectId)
              .map((obj) => (
                <SelectItem key={obj.id} value={obj.id.toString()}>
                  {obj.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAddRelation}>Add Relation</Button>
      </div>

      {relations && relations.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Related Object</TableHead>
              <TableHead>Relation Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relations.map((relation) => {
              const relatedObject = objects?.find(
                (obj) => obj.id === relation.targetId
              );
              return (
                <TableRow key={relation.id}>
                  <TableCell>{relatedObject?.name}</TableCell>
                  <TableCell>{relation.type}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveRelation(relation.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
