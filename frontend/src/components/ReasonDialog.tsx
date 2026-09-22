import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

interface ReasonDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function ReasonDialog({ open, title, confirmLabel, onClose, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const invalid = reason.trim().length < 3;

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Motivo"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={2}
          fullWidth
          required
        />
        {invalid && <Alert severity="warning" sx={{ mt: 2 }}>Informe um motivo com pelo menos 3 caracteres.</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={invalid} onClick={() => onConfirm(reason.trim())}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
