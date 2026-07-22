/**
 * [INPUT]: 依赖 React、motion 与 shared class 合并工具
 * [OUTPUT]: 对外提供支持 asChild、motion 化与 ref 合并的 Slot 及相关类型
 * [POS]: components/animate-ui 的底层组合 primitive；让动画组件安全复用调用方真实 DOM 节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
/* eslint-disable react-hooks/static-components -- motion 包装器由模块级 Map 按元素类型缓存，不会在重渲染时重建。 */
"use client";

import * as React from "react";
import { motion, isMotionComponent, type HTMLMotionProps } from "motion/react";
import { cn } from "@/shared/lib/utils";

type AnyProps = Record<string, unknown>;

type DOMMotionProps<T extends HTMLElement = HTMLElement> = Omit<HTMLMotionProps<keyof HTMLElementTagNameMap>, "ref"> & {
  ref?: React.Ref<T>;
};

type WithAsChild<Base extends object> = (Base & { asChild: true; children: React.ReactElement }) | (Base & { asChild?: false | undefined });

type SlotProps<T extends HTMLElement = HTMLElement> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any;
} & DOMMotionProps<T>;

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.RefObject<T | null>).current = node;
      }
    });
  };
}

function mergeProps<T extends HTMLElement>(childProps: AnyProps, slotProps: DOMMotionProps<T>): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };

  if (childProps.className || slotProps.className) {
    merged.className = cn(childProps.className as string, slotProps.className as string);
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style as React.CSSProperties),
      ...(slotProps.style as React.CSSProperties),
    };
  }

  return merged;
}

const motionComponentCache = new Map<React.ElementType, React.ElementType>();

function resolveMotionComponent(type: React.ElementType) {
  if (typeof type === "object" && type !== null && isMotionComponent(type)) return type;
  const cached = motionComponentCache.get(type);
  if (cached) return cached;
  const component = motion.create(type);
  motionComponentCache.set(type, component);
  return component;
}

function Slot<T extends HTMLElement = HTMLElement>({ children, ref, ...props }: SlotProps<T>) {
  if (!React.isValidElement(children)) return null;

  const Base = resolveMotionComponent(children.type as React.ElementType);
  const { ref: childRef, ...childProps } = children.props as AnyProps;

  const mergedProps = mergeProps(childProps, props);

  return <Base {...mergedProps} ref={mergeRefs(childRef as React.Ref<T>, ref)} />;
}

export { Slot, type SlotProps, type WithAsChild, type DOMMotionProps, type AnyProps };
