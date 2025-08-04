import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Save, X, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchUserAffirmations, addAffirmation, updateAffirmation, deleteAffirmation, reorderAffirmations, Affirmation } from "@/lib/affirmations";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AffirmationsManagerProps {
  onAffirmationsChange?: () => void;
}

interface SortableAffirmationItemProps {
  affirmation: Affirmation;
  isEditing: boolean;
  editText: string;
  isLoading: boolean;
  onEdit: (affirmation: Affirmation) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditTextChange: (text: string) => void;
}

function SortableAffirmationItem({
  affirmation,
  isEditing,
  editText,
  isLoading,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditTextChange,
}: SortableAffirmationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: affirmation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      
      {isEditing ? (
        <div className="flex-1 space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSaveEdit}
              disabled={isLoading || !editText.trim()}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
              disabled={isLoading}
              className="gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="flex-1 text-sm font-medium text-foreground leading-relaxed">
            {affirmation.text}
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(affirmation)}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(affirmation.id)}
              disabled={isLoading}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function AffirmationsManager({ onAffirmationsChange }: AffirmationsManagerProps) {
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newAffirmationText, setNewAffirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadAffirmations();
  }, []);

  const loadAffirmations = async () => {
    const data = await fetchUserAffirmations();
    setAffirmations(data);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = affirmations.findIndex((item) => item.id === active.id);
    const newIndex = affirmations.findIndex((item) => item.id === over.id);

    const newAffirmations = arrayMove(affirmations, oldIndex, newIndex);
    
    // Optimistically update the UI
    setAffirmations(newAffirmations);
    
    // Update the database
    const success = await reorderAffirmations(newAffirmations);
    
    if (success) {
      onAffirmationsChange?.();
      toast({
        title: "Order updated",
        description: "Affirmations have been reordered.",
      });
    } else {
      // Revert the optimistic update if it failed
      setAffirmations(affirmations);
      toast({
        title: "Error",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async () => {
    if (!newAffirmationText.trim()) return;
    
    setIsLoading(true);
    const newAffirmation = await addAffirmation(newAffirmationText);
    
    if (newAffirmation) {
      setAffirmations(prev => [...prev, newAffirmation]);
      setNewAffirmationText("");
      setShowAddDialog(false);
      onAffirmationsChange?.();
      toast({
        title: "Affirmation added",
        description: "Your new affirmation has been saved.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to add affirmation. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleEdit = (affirmation: Affirmation) => {
    setEditingId(affirmation.id);
    setEditText(affirmation.text);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    
    setIsLoading(true);
    const success = await updateAffirmation(editingId, editText);
    
    if (success) {
      setAffirmations(prev => 
        prev.map(aff => 
          aff.id === editingId ? { ...aff, text: editText.trim() } : aff
        )
      );
      setEditingId(null);
      setEditText("");
      onAffirmationsChange?.();
      toast({
        title: "Affirmation updated",
        description: "Your affirmation has been saved.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update affirmation. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    const success = await deleteAffirmation(id);
    
    if (success) {
      setAffirmations(prev => prev.filter(aff => aff.id !== id));
      onAffirmationsChange?.();
      toast({
        title: "Affirmation deleted",
        description: "Your affirmation has been removed.",
      });
    } else {
      toast({
        title: "Error", 
        description: "Failed to delete affirmation. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Affirmation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your affirmation..."
                value={newAffirmationText}
                onChange={(e) => setNewAffirmationText(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAdd}
                  disabled={isLoading || !newAffirmationText.trim()}
                >
                  Add Affirmation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={affirmations.map(a => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {affirmations.map((affirmation) => (
              <SortableAffirmationItem
                key={affirmation.id}
                affirmation={affirmation}
                isEditing={editingId === affirmation.id}
                editText={editText}
                isLoading={isLoading}
                onEdit={handleEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onDelete={handleDelete}
                onEditTextChange={setEditText}
              />
            ))}
            {affirmations.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No affirmations yet. Add your first one above!
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}