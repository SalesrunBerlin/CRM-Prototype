import useSWR from "swr";
import { useState, useCallback } from "react";
import { type Object } from "db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ObjectForm from "./ObjectForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUser } from "../hooks/use-user";
import debounce from 'lodash/debounce';
import { ChevronDownIcon } from "lucide-react";

interface UserRole {
  name: string;
  permissions: {
    all?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
}

interface User {
  id: number;
  username: string;
  roles?: UserRole[];
  companyId?: number;
}

export default function ObjectList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("_all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Build the query string for filtering
  const queryString = new URLSearchParams({
    ...(searchTerm && { search: searchTerm }),
    ...(selectedType !== '_all' && { type: selectedType }),
    ...(Object.keys(fieldFilters).length > 0 && { fields: JSON.stringify(fieldFilters) }),
    sortBy,
    sortOrder,
  }).toString();

  const { data: objects, mutate } = useSWR<Object[]>(`/api/objects?${queryString}`);
  const { data: types } = useSWR<string[]>("/api/object-types");
  const [selectedObject, setSelectedObject] = useState<Object | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { user } = useUser();

  const canCreate = (user as User)?.roles?.some(r => r.permissions.create === true || r.permissions.all === true);
  const canUpdate = (user as User)?.roles?.some(r => r.permissions.update === true || r.permissions.all === true);
  const canDelete = (user as User)?.roles?.some(r => r.permissions.delete === true || r.permissions.all === true);

  const handleEdit = (object: Object) => {
    if (!canUpdate) return;
    setSelectedObject(object);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setSelectedObject(null);
    setIsFormOpen(false);
  };

  const handleSave = async () => {
    await mutate();
    handleClose();
  };

  const handleDelete = async (objectId: number) => {
    if (!canDelete) return;
    try {
      const response = await fetch(`/api/objects/${objectId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete object");
      await mutate();
    } catch (error) {
      console.error("Failed to delete object:", error);
    }
  };

  // Debounce search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleFieldFilter = (field: string, value: string) => {
    setFieldFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType("_all");
    setFieldFilters({});
    setShowAdvancedFilters(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Objects</h2>
        {canCreate && (
          <Button onClick={() => setIsFormOpen(true)}>Create Object</Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search in name, type, and description..."
              onChange={(e) => debouncedSearch(e.target.value)}
              value={searchTerm}
              className="max-w-sm"
            />
          </div>
          <Select
            value={selectedType}
            onValueChange={setSelectedType}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              {types?.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Collapsible
          open={showAdvancedFilters}
          onOpenChange={setShowAdvancedFilters}
          className="space-y-2"
        >
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              Advanced Filters
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${
                  showAdvancedFilters ? "transform rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email Contains:</label>
                <Input
                  value={fieldFilters.email || ""}
                  onChange={(e) => handleFieldFilter("email", e.target.value)}
                  placeholder="Filter by email..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone Contains:</label>
                <Input
                  value={fieldFilters.phone || ""}
                  onChange={(e) => handleFieldFilter("phone", e.target.value)}
                  placeholder="Filter by phone..."
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-2"
            >
              Clear All Filters
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort('name')}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort('type')}
            >
              Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead>Description</TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort('createdAt')}
            >
              Created At {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objects?.map((object) => (
            <TableRow key={object.id}>
              <TableCell>{object.name}</TableCell>
              <TableCell>{object.type}</TableCell>
              <TableCell>{object.description}</TableCell>
              <TableCell>
                {object.createdAt ? new Date(object.createdAt).toLocaleDateString() : ''}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(object)}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(object.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedObject ? "Edit Object" : "Create New Object"}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {selectedObject ? "update" : "create"} an object. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <ObjectForm
            object={selectedObject}
            onSave={handleSave}
            onCancel={handleClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
