import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchUserAffirmations, addAffirmation, updateAffirmation, deleteAffirmation, Affirmation } from "@/lib/affirmations";

interface AffirmationsManagerProps {
  onAffirmationsChange?: () => void;
}

export function AffirmationsManager({ onAffirmationsChange }: AffirmationsManagerProps) {
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newAffirmationText, setNewAffirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAffirmations();
  }, []);

  const loadAffirmations = async () => {
    const data = await fetchUserAffirmations();
    setAffirmations(data);
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
      <div className="space-y-3">
          {affirmations.map((affirmation) => (
            <div 
              key={affirmation.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {editingId === affirmation.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isLoading || !editText.trim()}
                      className="gap-1"
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
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
                      onClick={() => handleEdit(affirmation)}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(affirmation.id)}
                      disabled={isLoading}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {affirmations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No affirmations yet. Add your first one above!
            </p>
        )}
      </div>
    </div>
  );
}