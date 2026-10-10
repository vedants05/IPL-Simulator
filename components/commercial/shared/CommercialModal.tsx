"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
export default function CommercialModal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        return () => previous?.focus();
    }, []);
    return <div className="commercial-modal-backdrop" onMouseDown={e => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
        <div className="commercial-modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={e => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
            if (e.key !== "Tab")
                return;
            const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []);
            const first = controls[0], last = controls.at(-1);
            if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
                e.preventDefault();
                last?.focus();
            }
            else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
                e.preventDefault();
                first?.focus();
            }
        }}><header><h3>{title}</h3><button aria-label="Close dialog" onClick={onClose}>Close ×</button></header>{children}</div>
    </div>;
}
