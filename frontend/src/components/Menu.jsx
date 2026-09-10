import { useEffect, useRef, useState } from "react";

import { IconChevronRight, IconDots } from "./Icons";

/**
 * ⋯ dropdown, aligned to the right edge of its trigger.
 * `items` entries:
 *   { label, icon?, onClick, danger?, disabled? }
 *   { label, icon?, submenu: [{ label, checked?, onClick }] }  — expands inline on click
 *   { separator: true }
 * Any entry may carry `hidden: true` to be skipped.
 */
export default function Menu({ items, label = "More actions" }) {
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setOpenSub(null);
  }

  const visible = items.filter((it) => !it.hidden);

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        type="button"
        className="icon-btn menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <IconDots width={18} height={18} />
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          {visible.map((item, i) => {
            if (item.separator) return <div key={`sep-${i}`} className="menu-sep" role="separator" />;

            if (item.submenu) {
              const isOpen = openSub === i;
              return (
                <div key={item.label} className={isOpen ? "menu-group is-open" : "menu-group"}>
                  <button
                    type="button"
                    className="menu-item-btn"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    onClick={() => setOpenSub(isOpen ? null : i)}
                  >
                    {item.icon && <span className="menu-item-icon">{item.icon}</span>}
                    <span className="menu-item-label">{item.label}</span>
                    <span className={isOpen ? "menu-caret is-open" : "menu-caret"}>
                      <IconChevronRight width={14} height={14} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="menu-submenu" role="menu">
                      {item.submenu.map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          className={sub.checked ? "menu-item-btn is-checked" : "menu-item-btn"}
                          role="menuitemradio"
                          aria-checked={!!sub.checked}
                          onClick={() => {
                            sub.onClick?.();
                            close();
                          }}
                        >
                          <span className="menu-check" aria-hidden="true">{sub.checked ? "✓" : ""}</span>
                          <span className="menu-item-label">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? "menu-item-btn is-danger" : "menu-item-btn"}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  close();
                }}
              >
                {item.icon && <span className="menu-item-icon">{item.icon}</span>}
                <span className="menu-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
