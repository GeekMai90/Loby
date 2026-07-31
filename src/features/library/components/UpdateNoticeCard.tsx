/**
 * [INPUT]: 依赖 motion、BorderGlow、shadcn/ui Button 与更新按钮状态组件，以及 app 注入的更新状态和动作
 * [OUTPUT]: 对外提供 UpdateNoticeCard
 * [POS]: 更新提醒卡片的生产视图；同时被导航栏和开发态设计系统复用，不持有 updater 生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { motion, useReducedMotion } from "motion/react";
import { PartyPopper, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BorderGlow } from "@/shared/components/BorderGlow";
import { UpdateActionButton } from "@/features/library/components/UpdateActionButton";

interface UpdateNoticeCardProps {
  updateBusy: boolean;
  updateInstalling: boolean;
  updateProgress: number | null;
  onInstallUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateNoticeCard({ updateBusy, updateInstalling, updateProgress, onInstallUpdate, onDismiss }: UpdateNoticeCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const description = updateInstalling ? "点击重启完成安装" : updateBusy ? "正在下载，请稍候" : "落笔有新变化，等你发现";

  return (
    <motion.div
      className="relative -mx-1 rounded-lg bg-background shadow-sm"
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      data-update-notice="true"
      role="status"
      aria-live="polite"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <BorderGlow active={hovered} duration={4.8} />
      <div className="group relative z-[1] px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <PartyPopper className="size-4 shrink-0 text-primary" />
          <p className="text-xs font-semibold text-foreground">新版本可用</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            surface="transparent"
            className="absolute top-1 right-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-transparent hover:text-foreground"
            aria-label="关闭更新提醒"
            title="关闭更新提醒"
            data-update-notice-close="true"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{description}</p>
        <UpdateActionButton
          updateBusy={updateBusy}
          updateInstalling={updateInstalling}
          updateProgress={updateProgress}
          onClick={onInstallUpdate}
        />
      </div>
    </motion.div>
  );
}
