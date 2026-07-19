import { toast } from "sonner";
import { AppToast, type AppToastVariant } from "../components/AppToast";

interface ShowAppToastOptions {
  variant: AppToastVariant;
  title: string;
  description: string;
  duration?: number;
  id?: string | number;
}

export function showAppToast({ variant, title, description, duration = 4000, id }: ShowAppToastOptions) {
  return toast.custom(
    (toastId) => <AppToast variant={variant} title={title} description={description} onClose={() => toast.dismiss(toastId)} />,
    { duration, id },
  );
}
