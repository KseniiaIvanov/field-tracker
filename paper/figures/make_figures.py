#!/usr/bin/env python3
"""
Generate publication figures for the Field Campaign Tracker (FCT) manuscript.

Figure 1 - Application overview: stylized field-entry interface (two screens)
           and the offline data-flow / architecture diagram.
Figure 2 - Representativeness-aware sampling: study-area raster with sampled
           sites, sampled-vs-area histogram comparison, and the adaptive
           sampling planner with prioritized candidate points.

Outputs PNG (300 dpi) and vector PDF into the same directory.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, FancyArrowPatch, Circle
from matplotlib.lines import Line2D
import os

# ----------------------------------------------------------------------------
# Style / palette (approximating the app's Material-3 purple theme)
# ----------------------------------------------------------------------------
PRIMARY      = "#5B3FA8"   # purple
PRIMARY_DK   = "#43308A"
PRIMARY_LT   = "#ECE6F8"   # light lavender field background
GREEN        = "#2E7D32"   # active / accent
BORDER       = "#CFC4E6"
TEXT         = "#1C1B1F"
MUTED        = "#6B6B72"
SCREEN_BG    = "#FFFFFF"
PHONE_BODY   = "#222028"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 8,
    "axes.linewidth": 0.8,
    "savefig.dpi": 300,
})

HERE = os.path.dirname(os.path.abspath(__file__))


# ----------------------------------------------------------------------------
# Helpers for the phone mock-ups
# ----------------------------------------------------------------------------
def round_rect(ax, x, y, w, h, r, fc, ec="none", lw=0, z=1):
    p = FancyBboxPatch((x + r, y + r), w - 2 * r, h - 2 * r,
                       boxstyle=f"round,pad={r},rounding_size={r}",
                       linewidth=lw, edgecolor=ec, facecolor=fc, zorder=z)
    ax.add_patch(p)
    return p


def field_box(ax, x, y, w, h, label, value, value_color=TEXT, value_size=7.5,
              fc=PRIMARY_LT, value_weight="normal"):
    """A labelled input field: small caps label above a rounded value box."""
    ax.text(x, y + h + 1.5, label, fontsize=5.6, color=MUTED,
            ha="left", va="bottom", weight="bold")
    round_rect(ax, x, y, w, h, 1.6, fc, ec=BORDER, lw=0.7, z=2)
    ax.text(x + 3, y + h / 2, value, fontsize=value_size, color=value_color,
            ha="left", va="center", zorder=3, weight=value_weight)


def pill(ax, x, y, w, h, text, fc, tc, fontsize=6.2, z=3, weight="bold", r=1.4):
    round_rect(ax, x, y, w, h, r, fc, z=z)
    ax.text(x + w / 2, y + h / 2, text, color=tc, ha="center", va="center",
            fontsize=fontsize, zorder=z + 1, weight=weight)


def cover_buttons(ax, x, y, active, labels=("0", "1", "2")):
    """Three small cover-class buttons; `active` index is highlighted."""
    bw, gap = 7.5, 2.2
    for i, lab in enumerate(labels):
        bx = x + i * (bw + gap)
        on = (i == active)
        pill(ax, bx, y, bw, 8, lab,
             fc=PRIMARY if on else "#F4F1FB",
             tc="white" if on else MUTED, fontsize=7, r=1.4)
    return x + 3 * bw + 2 * gap


def phone_frame(ax, title, subtitle, progress=None):
    """Draw the phone body + header; return inner screen bounds (x,y,w,h)."""
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 214)          # headroom so panel labels are not clipped
    ax.set_aspect("equal")
    ax.axis("off")

    # body + screen
    round_rect(ax, 4, 2, 92, 201, 7, PHONE_BODY, z=1)
    sx, sy, sw, sh = 8, 8, 84, 189
    round_rect(ax, sx, sy, sw, sh, 4, SCREEN_BG, z=1.5)

    # header band
    hy = sy + sh - 26
    ax.add_patch(Rectangle((sx, hy), sw, 26, facecolor=PRIMARY, zorder=2,
                           clip_path=None))
    ax.text(sx + sw / 2, hy + 17, title, color="white", ha="center",
            va="center", fontsize=8.5, weight="bold", zorder=3)
    ax.text(sx + sw / 2, hy + 8, subtitle, color="#E9E2FA", ha="center",
            va="center", fontsize=6.4, zorder=3)

    # progress bar
    if progress is not None:
        py = hy - 3
        ax.add_patch(Rectangle((sx + 6, py), sw - 12, 1.6, facecolor="#E2DAF3",
                               zorder=3))
        ax.add_patch(Rectangle((sx + 6, py), (sw - 12) * progress, 1.6,
                               facecolor=GREEN, zorder=4))
    return sx, sy, sw, sh


# ----------------------------------------------------------------------------
# FIGURE 1
# ----------------------------------------------------------------------------
def figure1():
    fig = plt.figure(figsize=(7.2, 4.7))
    gs = fig.add_gridspec(1, 3, width_ratios=[1, 1, 1.55], wspace=0.08,
                          left=0.005, right=0.995, top=0.99, bottom=0.01)

    # ---- Panel (a): Site-information screen ------------------------------
    axa = fig.add_subplot(gs[0, 0])
    sx, sy, sw, sh = phone_frame(axa, "Field diary", "Step 1 / 5  ·  Site information",
                                 progress=0.20)
    x0 = sx + 6
    top = sy + sh - 34
    # section header + GPS button
    pill(axa, x0, top, 40, 9, "Site info  ▼", PRIMARY_LT, PRIMARY, fontsize=6.4)
    pill(axa, x0 + 43, top, 25, 9, "Get GPS", GREEN, "white", fontsize=6.2)
    # row: site / date / time
    r1 = top - 22
    field_box(axa, x0, r1, 20, 9, "SITE #", "−  1  +", value_size=6.4)
    field_box(axa, x0 + 23, r1, 22, 9, "DATE", "02.06.26", value_size=6.0)
    field_box(axa, x0 + 48, r1, 20, 9, "TIME", "15:41", value_size=6.4)
    # lat / lon
    r2 = r1 - 20
    field_box(axa, x0, r2, 33, 9, "LATITUDE", "68.3561", value_size=6.6)
    field_box(axa, x0 + 35, r2, 33, 9, "LONGITUDE", "18.8112", value_size=6.6)
    # landscape / organic
    r3 = r2 - 20
    field_box(axa, x0, r3, 33, 9, "LANDSCAPE", "Palsa mire", value_size=6.2)
    field_box(axa, x0 + 35, r3, 33, 9, "ORGANIC MATTER", "Peat", value_size=6.2)
    # disturbance / notes
    r4 = r3 - 20
    field_box(axa, x0, r4, 33, 9, "DISTURBANCE", "Thermokarst", value_size=5.8)
    field_box(axa, x0 + 35, r4, 33, 9, "NOTES", "...", value_size=6.4)
    # media buttons
    r5 = r4 - 17
    pill(axa, x0, r5, 21, 9, "Photo", PRIMARY, "white", fontsize=6.2)
    pill(axa, x0 + 23, r5, 21, 9, "Gallery", "#F4F1FB", MUTED, fontsize=6.2)
    pill(axa, x0 + 46, r5, 22, 9, "Voice", "#F4F1FB", MUTED, fontsize=6.2)
    # nav
    pill(axa, x0, sy + 6, 30, 9, "← Back", "#F0F0F0", MUTED, fontsize=6.2)
    pill(axa, x0 + 38, sy + 6, 30, 9, "Next →", PRIMARY, "white", fontsize=6.4)
    axa.text(2, 211, "(a)", fontsize=10, weight="bold", va="top", ha="left")

    # ---- Panel (b): Vegetation cover-class screen ------------------------
    axb = fig.add_subplot(gs[0, 1])
    sx, sy, sw, sh = phone_frame(axb, "Vegetation", "Step 3 / 5  ·  Rapid cover",
                                 progress=0.60)
    x0 = sx + 6
    top = sy + sh - 33
    axb.text(x0, top + 4, "Cover class", fontsize=6.2, color=MUTED, weight="bold")
    axb.text(x0 + 38, top + 4, "0·1·2", fontsize=6.0, color=MUTED,
             ha="center")
    axb.text(x0 + 60, top + 4, "cm", fontsize=6.0, color=MUTED, ha="center")
    veg = [("Shrubs", 1, "18"), ("Dwarf shrubs", 2, "9"),
           ("Graminoids", 1, "22"), ("Sedges", 0, ""),
           ("Sphagnum", 2, ""), ("Other mosses", 1, ""),
           ("Lichens", 0, ""), ("Bare peat", 0, ""),
           ("Litter", 1, "")]
    ry = top - 6
    rowh = 13.5
    for name, act, ht in veg:
        round_rect(axb, x0, ry - 9, sw - 12, 11, 1.6, "#F7F5FC", ec=BORDER,
                   lw=0.5, z=1.8)
        axb.text(x0 + 2.5, ry - 3.5, name, fontsize=6.2, color=TEXT,
                 va="center", zorder=3)
        cover_buttons(axb, x0 + 30, ry - 8.5, act)
        # height field
        round_rect(axb, x0 + 58, ry - 8.5, 12, 8, 1.2, "white", ec=BORDER,
                   lw=0.6, z=2)
        axb.text(x0 + 64, ry - 4.5, ht if ht else "—", fontsize=6.0,
                 color=TEXT if ht else MUTED, ha="center", va="center", zorder=3)
        ry -= rowh
    pill(axb, x0, sy + 6, 30, 9, "← Back", "#F0F0F0", MUTED, fontsize=6.2)
    pill(axb, x0 + 38, sy + 6, 30, 9, "Next →", PRIMARY, "white", fontsize=6.4)
    axb.text(2, 211, "(b)", fontsize=10, weight="bold", va="top", ha="left")

    # ---- Panel (c): data-flow / architecture ----------------------------
    axc = fig.add_subplot(gs[0, 2])
    axc.set_xlim(0, 110)          # extra right margin for the feedback loop
    axc.set_ylim(0, 214)
    axc.axis("off")
    axc.text(1, 211, "(c)", fontsize=10, weight="bold", va="top", ha="left")

    def box(x, y, w, h, title, body, fc, tc=TEXT, title_color=None, z=2):
        round_rect(axc, x, y, w, h, 2.2, fc, ec=BORDER, lw=0.8, z=z)
        axc.text(x + w / 2, y + h - 5.5, title, ha="center", va="center",
                 fontsize=7.4, weight="bold",
                 color=title_color if title_color else tc, zorder=z + 1)
        if body:
            axc.text(x + w / 2, y + (h - 9) / 2, body, ha="center", va="center",
                     fontsize=6.0, color=tc, zorder=z + 1)

    def arrow(x1, y1, x2, y2):
        axc.add_patch(FancyArrowPatch((x1, y1), (x2, y2),
                      arrowstyle="-|>", mutation_scale=9, lw=1.3,
                      color=PRIMARY_DK, zorder=1))

    # 1. capture
    box(8, 168, 84, 30, "1 · Offline field capture",
        "Site · Weather · Vegetation\nSoil · Morphology · GPS · Photos · Audio",
        PRIMARY_LT, title_color=PRIMARY_DK)
    # 2. storage
    arrow(50, 168, 50, 152)
    box(8, 122, 84, 28, "2 · On-device storage",
        "IndexedDB  +  device folder\n(auto-save, works without network)",
        "#EAF4EA", title_color=GREEN)
    # 3. export
    arrow(50, 122, 50, 106)
    box(8, 80, 84, 24, "3 · Open, interoperable export",
        "JSON  ·  text summary  ·  CSV\nstandardized file names + media",
        "#FFF7E6", title_color="#9A6A00")
    # 4. two analysis boxes
    arrow(30, 80, 26, 64)
    arrow(70, 80, 74, 64)
    box(4, 34, 44, 28, "4a · Representativeness",
        "sampled vs.\narea distribution\n(per raster layer)",
        PRIMARY_LT, title_color=PRIMARY_DK)
    box(52, 34, 44, 28, "4b · Sampling planner",
        "prioritized\ncandidate points\nfor under-sampled\nconditions",
        PRIMARY_LT, title_color=PRIMARY_DK)
    # loop-back arrow from planner to capture (kept inside the widened x-range)
    axc.add_patch(FancyArrowPatch((96, 48), (92, 183),
                  connectionstyle="arc3,rad=0.30", arrowstyle="-|>",
                  mutation_scale=9, lw=1.2, color=GREEN, ls=(0, (3, 2)),
                  zorder=5))
    axc.text(109, 118, "adaptive\nfeedback", rotation=90, fontsize=5.8,
             color=GREEN, ha="center", va="center", weight="bold")

    fig.savefig(os.path.join(HERE, "Figure1_application.png"),
                bbox_inches="tight", pad_inches=0.05)
    fig.savefig(os.path.join(HERE, "Figure1_application.pdf"),
                bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)
    print("Figure 1 written.")


# ----------------------------------------------------------------------------
# FIGURE 2  (uses a deterministic synthetic raster, e.g. a wetness index)
# ----------------------------------------------------------------------------
def figure2():
    rng = np.random.default_rng(7)
    n = 220
    # geographic extent near Abisko, Sweden
    lon = np.linspace(18.780, 18.825, n)
    lat = np.linspace(68.340, 68.362, n)
    LON, LAT = np.meshgrid(lon, lat)
    X = (LON - lon[0]) / (lon[-1] - lon[0])
    Y = (LAT - lat[0]) / (lat[-1] - lat[0])

    # smooth, organic field -> normalize to 0..1 (low = wet, high = dry)
    field = (np.sin(3.1 * X + 0.7) + np.cos(2.6 * Y + 0.4)
             + 0.6 * np.sin(5.0 * X * Y + 0.2) + 0.45 * np.cos(4.2 * Y)
             + 0.35 * np.sin(6 * Y + 2 * X))
    field += 0.06 * rng.standard_normal(field.shape)
    field = (field - field.min()) / (field.max() - field.min())

    # ---- existing sites: biased toward DRY (high) values -> low values under-sampled
    cand = rng.uniform(0, 1, size=(4000, 2))
    ix = (cand[:, 0] * (n - 1)).astype(int)
    iy = (cand[:, 1] * (n - 1)).astype(int)
    v = field[iy, ix]
    keep_p = v ** 3                      # strong bias to high values
    keep_p /= keep_p.max()
    accept = rng.uniform(0, 1, size=v.shape) < keep_p
    sel = np.where(accept)[0][:17]
    site_lon = lon[ix[sel]]
    site_lat = lat[iy[sel]]
    site_val = v[sel]

    # ---- under-sampled range and candidate points (low values, far from sites)
    thr = 0.34
    under = field < thr
    yy, xx = np.where(under)
    pick = rng.permutation(len(xx))
    cand_pts = []
    for k in pick:
        clo, cla = lon[xx[k]], lat[yy[k]]
        if all((clo - sl) ** 2 + (cla - sla) ** 2 > 0.004 ** 2
               for sl, sla in zip(site_lon, site_lat)) and \
           all((clo - cl) ** 2 + (cla - cla2) ** 2 > 0.006 ** 2
               for cl, cla2, _ in cand_pts):
            cand_pts.append((clo, cla, field[yy[k], xx[k]]))
        if len(cand_pts) >= 9:
            break
    cand_pts = np.array(cand_pts)
    # priority = how far below threshold (lower value -> higher priority)
    prio = (thr - cand_pts[:, 2]) / thr

    extent = [lon[0], lon[-1], lat[0], lat[-1]]
    fig = plt.figure(figsize=(7.2, 2.95))
    gs = fig.add_gridspec(1, 3, width_ratios=[1, 1.15, 1], wspace=0.42,
                          left=0.055, right=0.965, top=0.86, bottom=0.18)

    # ---- (a) raster + sampled sites
    axa = fig.add_subplot(gs[0, 0])
    im = axa.imshow(field, origin="lower", extent=extent, cmap="YlGnBu_r",
                    aspect="auto", vmin=0, vmax=1)
    axa.scatter(site_lon, site_lat, s=22, facecolor="white",
                edgecolor="black", linewidth=0.8, zorder=3, label="sampled site")
    axa.set_title("(a) Study area + sampled sites", fontsize=8, weight="bold")
    axa.set_xlabel("Longitude", fontsize=6.8)
    axa.set_ylabel("Latitude", fontsize=6.8)
    axa.tick_params(labelsize=5.6)
    cb = fig.colorbar(im, ax=axa, fraction=0.046, pad=0.03)
    cb.set_label("wetness index", fontsize=6.2)
    cb.ax.tick_params(labelsize=5.4)
    axa.legend(loc="lower left", fontsize=5.4, framealpha=0.9,
               handletextpad=0.3, borderpad=0.3)

    # ---- (b) histogram comparison
    axb = fig.add_subplot(gs[0, 1])
    bins = np.linspace(0, 1, 26)
    axb.hist(field.ravel(), bins=bins, density=True, color="#9aa0a6",
             alpha=0.55, label="whole study area")
    axb.hist(site_val, bins=bins, density=True, histtype="step",
             color=PRIMARY, linewidth=1.6, label="sampled sites")
    axb.axvspan(0, thr, color="#E53935", alpha=0.12)
    ymax = axb.get_ylim()[1]
    axb.annotate("under-sampled\nrange",
                 xy=(thr / 2, ymax * 0.82), ha="center", fontsize=6.0,
                 color="#B71C1C", weight="bold")
    axb.axvline(thr, color="#E53935", lw=1.0, ls=(0, (4, 2)))
    axb.set_title("(b) Sampled vs. area distribution", fontsize=8, weight="bold")
    axb.set_xlabel("wetness index", fontsize=6.8)
    axb.set_ylabel("density", fontsize=6.8)
    axb.tick_params(labelsize=5.6)
    axb.legend(loc="upper right", fontsize=5.6, framealpha=0.9,
               handletextpad=0.5, borderpad=0.3)

    # ---- (c) planner: candidates targeting under-sampled range
    axc = fig.add_subplot(gs[0, 2])
    axc.imshow(field, origin="lower", extent=extent, cmap="Greys",
               aspect="auto", vmin=-0.2, vmax=1.4, alpha=0.55)
    # shade under-sampled pixels
    mask_rgba = np.zeros((*field.shape, 4))
    mask_rgba[under] = (0.90, 0.20, 0.18, 0.20)
    axc.imshow(mask_rgba, origin="lower", extent=extent, aspect="auto")
    axc.scatter(site_lon, site_lat, s=14, facecolor="#cfcfcf",
                edgecolor="black", linewidth=0.5, zorder=3, label="existing site")
    sc = axc.scatter(cand_pts[:, 0], cand_pts[:, 1], c=prio, cmap="autumn_r",
                     marker="*", s=130, edgecolor="black", linewidth=0.5,
                     vmin=0, vmax=1, zorder=4, label="candidate point")
    axc.set_title("(c) Adaptive sampling planner", fontsize=8, weight="bold")
    axc.set_xlabel("Longitude", fontsize=6.8)
    axc.set_ylabel("Latitude", fontsize=6.8)
    axc.tick_params(labelsize=5.6)
    cb2 = fig.colorbar(sc, ax=axc, fraction=0.046, pad=0.03)
    cb2.set_label("priority", fontsize=6.2)
    cb2.ax.tick_params(labelsize=5.4)
    axc.legend(loc="lower left", fontsize=5.0, framealpha=0.9,
               handletextpad=0.3, borderpad=0.3, scatterpoints=1)

    fig.savefig(os.path.join(HERE, "Figure2_representativeness.png"),
                bbox_inches="tight", pad_inches=0.05)
    fig.savefig(os.path.join(HERE, "Figure2_representativeness.pdf"),
                bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)
    print("Figure 2 written.")


if __name__ == "__main__":
    figure1()
    figure2()
    print("Done. Files in", HERE)
