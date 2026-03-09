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

  return (
    <ConfirmDialogContext.Provider value={{ openConfirmModal, openInfoModal }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-xs rounded-2xl p-6 gap-0"
          style={modal?.type === 'confirm' && modal.zIndex ? { zIndex: modal.zIndex } : undefined}
        >
          {modal?.type === 'confirm' ? (
            <>
              <p className="text-base font-medium text-center">{modal.title}</p>
              <div className="flex items-center justify-center gap-4 pt-5">
                <button
                  className="rounded-full border border-[#d4d4d4] bg-white px-6 py-2 text-sm text-[#404040] hover:bg-[#f5f5f5] transition-colors min-w-[100px]"
                  onClick={handleClose}
                >
                  {modal.labels.cancel}
                </button>
                <button
                  className={
                    modal.confirmProps?.color === 'red'
                      ? 'rounded-full border border-[#dc2626] bg-white px-6 py-2 text-sm text-[#dc2626] hover:bg-red-50 transition-colors min-w-[100px]'
                      : 'rounded-full border border-[#215042] bg-white px-6 py-2 text-sm text-[#215042] hover:bg-[#f0fdf4] transition-colors min-w-[100px]'
                  }
                  onClick={handleConfirm}
                >
                  {modal.labels.confirm}
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{modal?.title}</DialogTitle>
                <DialogDescription asChild>
                  <div>{modal?.children}</div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleClose}>OK</Button>
              </DialogFooter>
            </>
          )}
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
