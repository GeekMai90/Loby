/**
 * [INPUT]: 依赖 Tauri 窗口 API 与当前显示器工作区
 * [OUTPUT]: 对外提供 Windows 普通窗口启动边界修正
 * [POS]: shared/lib 的 Windows 窗口恢复适配器；只修正越过任务栏的已保存普通窗口，最大化与还原继续使用 Tauri 原生语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { currentMonitor, type Window as TauriWindow } from "@tauri-apps/api/window";

type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function fitWindowsWindowToWorkArea(appWindow: TauriWindow): Promise<void> {
  if (await appWindow.isMaximized()) return;

  const monitor = await currentMonitor();
  if (!monitor) return;
  const bounds = await readWindowBounds(appWindow);
  const clampedBounds = clampToWorkArea(bounds, monitor.workArea);
  if (sameBounds(bounds, clampedBounds)) return;
  await setWindowBounds(appWindow, clampedBounds);
}

async function readWindowBounds(appWindow: TauriWindow): Promise<WindowBounds> {
  const [position, size] = await Promise.all([appWindow.outerPosition(), appWindow.outerSize()]);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

async function setWindowBounds(
  appWindow: TauriWindow,
  bounds: WindowBounds | { position: { x: number; y: number }; size: { width: number; height: number } },
): Promise<void> {
  const position = "position" in bounds ? bounds.position : bounds;
  const size = "size" in bounds ? bounds.size : bounds;
  const frameInsets = await readWindowFrameInsets(appWindow);
  await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
  await appWindow.setSize(new PhysicalSize(Math.max(1, size.width - frameInsets.width), Math.max(1, size.height - frameInsets.height)));
}

/**
 * Tauri 的 setSize 设置客户区，而 currentMonitor().workArea 描述的是窗口外框可用区域。
 * 这里只修正窗口状态插件恢复出的普通窗口；最大化交给 Windows 原生窗口管理。
 */
async function readWindowFrameInsets(appWindow: TauriWindow): Promise<{ width: number; height: number }> {
  try {
    const [outerSize, innerSize] = await Promise.all([appWindow.outerSize(), appWindow.innerSize()]);
    return {
      width: Math.max(0, outerSize.width - innerSize.width),
      height: Math.max(0, outerSize.height - innerSize.height),
    };
  } catch {
    // 某些启动时刻窗口尺寸尚未可读，保留原始尺寸比阻断窗口操作更安全。
    return { width: 0, height: 0 };
  }
}

function clampToWorkArea(
  bounds: WindowBounds,
  workArea: { position: { x: number; y: number }; size: { width: number; height: number } },
): WindowBounds {
  const width = Math.min(bounds.width, workArea.size.width);
  const height = Math.min(bounds.height, workArea.size.height);
  const maxX = workArea.position.x + workArea.size.width - width;
  const maxY = workArea.position.y + workArea.size.height - height;
  return {
    x: Math.min(Math.max(bounds.x, workArea.position.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.position.y), maxY),
    width,
    height,
  };
}

function sameBounds(left: WindowBounds, right: WindowBounds): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}
