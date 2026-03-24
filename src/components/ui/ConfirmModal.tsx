import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmModal({ open, title, description, onConfirm, onCancel, isPending }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
        <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isPending} style={{ background: "var(--danger)", color: "white" }}>
            {isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
