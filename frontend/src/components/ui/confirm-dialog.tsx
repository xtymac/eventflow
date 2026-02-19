import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmModalOptions {
  title: string;
  children: ReactNode;
  labels: { confirm: string; cancel: string };
  confirmProps?: { color?: string };
  onConfirm: () => void;
  zIndex?: number;
}

interface InfoModalOptions {
  title: string;
  children: ReactNode;
}

type ModalOptions = (ConfirmModalOptions & { type: 'confirm' }) | (InfoModalOptions & { type: 'info' });

interface ConfirmDialogContextValue {
  openConfirmModal: (options: ConfirmModalOptions) => void;
  openInfoModal: (options: InfoModalOptions) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalOptions | null>(null);
  const [open, setOpen] = useState(false);

  const openConfirmModal = useCallback((options: ConfirmModalOptions) => {
    setModal({ ...options, type: 'confirm' });
    setOpen(true);
  }, []);

  const openInfoModal = useCallback((options: InfoModalOptions) => {
    setModal({ ...options, type: 'info' });
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setModal(null);
  };

  const handleConfirm = () => {
    if (modal?.type === 'confirm') {
      modal.onConfirm();
    }
    handleClose();
  };

  const getConfirmVariant = (color?: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
    if (color === 'red') return 'destructive';
    return 'default';
  };

  return (
    <ConfirmDialogContext.Provider value={{ openConfirmModal, openInfoModal }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          style={modal?.type === 'confirm' && modal.zIndex ? { zIndex: modal.zIndex } : undefined}
        >
          <DialogHeader>
            <DialogTitle>{modal?.title}</DialogTitle>
            <DialogDescription asChild>
              <div>{modal?.children}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {modal?.type === 'confirm' ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  {modal.labels.cancel}
                </Button>
                <Button
                  variant={getConfirmVariant(modal.confirmProps?.color)}
                  onClick={handleConfirm}
                >
                  {modal.labels.confirm}
                </Button>
              </>
            ) : (
              <Button onClick={handleClose}>OK</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}
