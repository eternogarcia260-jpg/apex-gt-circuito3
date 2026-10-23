/**
 * PilotModelBuilder.ts
 * High-Fidelity Anatomical Racing Pilot Construction Engine.
 * 
 * Replaces primitive box/cylinder meshes with an organic, anatomically sculpted racing driver:
 * - Ultra-HD PBR Nomex fabric with micro-aramid weave, diamond quilted padding, and embroidered FIA/sponsor patches.
 * - Anatomical hands with 5 individual articulated fingers and silicone grip texturing.
 * - Ergonomic competition racing boots (Alpinestars Supermono profile) with rounded pedal-pivot heel, sculpted arch, and toe rocker.
 * - FIA 8860 aerodynamic composite helmet with forward chin bar, Zylon visor reinforcement, HANS anchors, and tear-off posts.
 * - Continuous one-piece Nomex suit with integrated shoulder extraction epaulets, ribbed flex zones, and zero disjointed gaps.
 */

import * as THREE from 'three';
import { CustomLiverySettings } from '../career/CareerTypes';

export interface ProceduralPilotRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  pelvis: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  leftWrist: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightWrist: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  rightAnkle: THREE.Group;
  leftFootShadow: THREE.Mesh;
  rightFootShadow: THREE.Mesh;
}

export class PilotModelBuilder {
  private static cachedDiffuseMap: THREE.CanvasTexture | null = null;
  private static cachedNormalMap: THREE.CanvasTexture | null = null;
  private static cachedFootShadowTex: THREE.CanvasTexture | null = null;
  private static cachedBootNormalMap: THREE.CanvasTexture | null = null;
  private static cachedTextureKey: string = '';

  /**
   * Generates a 1024x1024 Ultra-HD diffuse albedo texture for the Nomex racing suit:
   * - Diagonal Kevlar/Nomex micro-twill weave
   * - Escudería aerodynamic flank panels and high-contrast piping
   * - Double-stitched seams with realistic thread spacing
   * - Stitched diamond quilting on lateral torso and lumbar stretch panels
   * - Official FIA Standard 8856-2018 homologation hologram patch
   * - Embroidered motorsport sponsor logos (Brembo, Pirelli, Apex Racing, Shell V-Power)
   * - Driver national flag & ID patch (#27 PRO DRIVER)
   */
  public static getSuitDiffuseMap(primaryHex: string, accentHex: string): THREE.CanvasTexture {
    const key = `${primaryHex}_${accentHex}`;
    if (this.cachedDiffuseMap && this.cachedTextureKey === key) {
      return this.cachedDiffuseMap;
    }

    if (typeof document === 'undefined') {
      return new THREE.Texture() as THREE.CanvasTexture;
    }

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const cx = size / 2; // Center of the front chest (U = 0.5)

      // 1. Base Dark Racing Green Fabric (#073826 to #09452d)
      // Subtle gradient creates natural textile light falloff, eliminating computer-flat plastic feel
      const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
      baseGrad.addColorStop(0.0, '#063523'); // Deep British Racing Green
      baseGrad.addColorStop(0.3, '#08402c');
      baseGrad.addColorStop(0.7, '#073926');
      baseGrad.addColorStop(1.0, '#052b1d');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Realistic 2D Nomex Aramid Micro-Twill Weave Matrix
      // Diagonal Kevlar/Nomex woven yarn structure that scatters light authentically like real fabric
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(25, 125, 82, 0.22)'; // Lighter green warp thread
      for (let i = -size; i < size * 2; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(2, 22, 14, 0.35)'; // Darker shadow weft thread
      for (let i = -size; i < size * 2; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i + size, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
      }

      // 3. Ergonomic Side Flank Panels (Darker Carbon-Emerald Stretch Panels)
      const flankGrad = ctx.createLinearGradient(0, 0, 0, size);
      flankGrad.addColorStop(0, '#042217');
      flankGrad.addColorStop(1, '#031a11');
      ctx.fillStyle = flankGrad;

      // Left flank (facing side/ribs)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(260, 0);
      ctx.bezierCurveTo(320, 280, 360, 600, 240, size);
      ctx.lineTo(0, size);
      ctx.closePath();
      ctx.fill();

      // Right flank
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(size - 260, 0);
      ctx.bezierCurveTo(size - 320, 280, size - 360, 600, size - 240, size);
      ctx.lineTo(size, size);
      ctx.closePath();
      ctx.fill();

      // 4. Diamond Quilted Nomex Padding on Lower Flanks
      this.drawDiamondQuilting(ctx, 40, 480, 200, 420);
      this.drawDiamondQuilting(ctx, size - 240, 480, 200, 420);

      // 5. Championship Gold High-Contrast Piping (#fbbf24) & Silver Stitching
      const goldAccent = accentHex && accentHex !== '#a3e635' ? accentHex : '#fbbf24';
      ctx.strokeStyle = goldAccent;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(260, 0);
      ctx.bezierCurveTo(320, 280, 360, 600, 240, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size - 260, 0);
      ctx.bezierCurveTo(size - 320, 280, size - 360, 600, size - 240, size);
      ctx.stroke();

      // Double-needle high-tensile white/silver safety stitching
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(272, 0);
      ctx.bezierCurveTo(332, 280, 372, 600, 252, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size - 272, 0);
      ctx.bezierCurveTo(size - 332, 280, size - 372, 600, size - 252, size);
      ctx.stroke();
      ctx.setLineDash([]);

      // 6. Central Concealed Storm Flap with Metal Racing Zipper
      ctx.fillStyle = '#05291b';
      ctx.fillRect(cx - 24, 0, 48, size * 0.54);
      ctx.strokeStyle = '#031b12';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - 24, 0, 48, size * 0.54);

      // Metallic zipper teeth
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 16);
      ctx.lineTo(cx, size * 0.52);
      ctx.stroke();
      ctx.setLineDash([]);

      // Metal pull tab with Alpinestars miniature icon
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx - 6, size * 0.51, 12, 24);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 3, size * 0.525, 6, 8);

      // Alpinestars Logo on Upper Collar Storm Flap
      this.drawAlpinestarsLogo(ctx, cx - 18, 55, 36, 36);

      // -----------------------------------------------------------------------
      // RAZOR-SHARP F1 TECHNICAL MOTORSPORT SPONSORS (NON-ASTON MARTIN)
      // -----------------------------------------------------------------------

      // 7. TAG HEUER / MAIN CHAMPIONSHIP TITLE PARTNER (Upper Center Chest, under collar)
      this.drawTagHeuerTitleLogo(ctx, cx - 140, 135, 280, 56);

      // 8. PIRELLI COMPETIZIONE (Upper Right Chest)
      this.drawPirelliLogo(ctx, cx + 75, 215, 155, 54);

      // 9. BREMBO RACING (Upper Left Chest)
      this.drawBremboLogo(ctx, cx - 230, 215, 155, 54);

      // 10. SPARCO PRO RACING (Mid Left Chest)
      this.drawSparcoLogo(ctx, cx - 225, 290, 145, 68);

      // 11. SHELL V-POWER / MOTORSPORT (Mid Right Chest)
      this.drawShellLogo(ctx, cx + 80, 290, 145, 68);

      // 12. MOBIL 1 MOTORSPORT PARTNER (Lower Left Chest)
      this.drawMobil1Logo(ctx, cx - 200, 380, 150, 42);

      // 13. OFFICIAL FIA STANDARD 8856-2018 HOMOLOGATION SEAL (Lower Right Chest)
      this.drawFiaHomologationPatch(ctx, cx + 50, 380, 150, 44);

      // 14. DRIVER BADGE & RACE NUMBER (#27 L. ROSSI, Abdomen Center)
      this.drawDriverBadge(ctx, cx - 110, 446, 220, 44);

      // 15. SLEEVE SPONSORS (IWC SCHAFFHAUSEN & BOSCH MOTORSPORT)
      this.drawSleeveBadges(ctx, 160, size - 160, 240);

      // 16. LARGE BACK TEAM BANNER (Upper Shoulders / Spine - APEX RACING TEAM)
      this.drawBackBanner(ctx, cx, 680, goldAccent);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    this.cachedDiffuseMap = tex;
    this.cachedTextureKey = key;
    return tex;
  }

  /**
   * Generates a 1024x1024 tangent-space Normal Map for the Nomex suit:
   * Encodes diagonal weave bumps, recessed stitch grooves, and raised 3D patch borders
   * that give the F1 sponsors authentic embroidered depth under track lighting.
   */
  public static getSuitNormalMap(): THREE.CanvasTexture {
    if (this.cachedNormalMap) return this.cachedNormalMap;
    if (typeof document === 'undefined') {
      return new THREE.Texture() as THREE.CanvasTexture;
    }

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base neutral normal map vector: (128, 128, 255) pointing directly out of surface
      ctx.fillStyle = 'rgb(128, 128, 255)';
      ctx.fillRect(0, 0, size, size);

      // Fine diagonal micro-weave (RGB perturbance for realistic light scattering)
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          // Diagonal woven fiber relief pattern (Nomex twill)
          const diag1 = Math.sin((x + y) * 0.95) * 8;
          const diag2 = Math.cos((x - y) * 0.95) * 8;
          data[idx] = Math.min(255, Math.max(0, 128 + diag1));
          data[idx + 1] = Math.min(255, Math.max(0, 128 + diag2));
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Embossed stitch lines
      ctx.strokeStyle = 'rgb(160, 128, 255)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(260, 0);
      ctx.bezierCurveTo(320, 280, 360, 600, 240, size);
      ctx.stroke();

      ctx.strokeStyle = 'rgb(96, 128, 255)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(size - 260, 0);
      ctx.bezierCurveTo(size - 320, 280, size - 360, 600, size - 240, size);
      ctx.stroke();

      // Raised 3D embroidery borders around major sponsor patches
      const cx = size / 2;
      const drawPatchBevel = (x: number, y: number, w: number, h: number) => {
        ctx.strokeStyle = 'rgb(160, 150, 255)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, w, h);
      };

      drawPatchBevel(cx - 140, 135, 280, 56); // Title Partner (TAG Heuer)
      drawPatchBevel(cx + 75, 215, 155, 54);  // Pirelli Competizione
      drawPatchBevel(cx - 230, 215, 155, 54); // Brembo Racing
      drawPatchBevel(cx - 225, 290, 145, 68); // Sparco Pro Racing
      drawPatchBevel(cx + 80, 290, 145, 68);  // Shell V-Power
      drawPatchBevel(cx - 200, 380, 150, 42); // Mobil 1 Motorsport
      drawPatchBevel(cx - 110, 446, 220, 44); // Driver Badge
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    this.cachedNormalMap = tex;
    return tex;
  }

  /**
   * Helper: draws diamond-quilted padding pattern with simulated thread indentation.
   */
  private static drawDiamondQuilting(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, startY, w, h);
    ctx.clip();

    ctx.fillStyle = '#031f14';
    ctx.fillRect(startX, startY, w, h);

    const step = 32;
    ctx.strokeStyle = '#052e1f';
    ctx.lineWidth = 2.5;

    for (let x = startX - h; x < startX + w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x + h, startY + h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, startY + h);
      ctx.lineTo(x + h, startY);
      ctx.stroke();
    }

    // Thread highlight dots at intersections
    ctx.fillStyle = 'rgba(163, 230, 53, 0.45)'; // Electric lime stitch accents
    for (let x = startX - h; x < startX + w + h; x += step) {
      for (let y = startY; y <= startY + h; y += step) {
        ctx.fillRect(x + (y - startY) - 1, y - 1, 2, 2);
      }
    }
    ctx.restore();
  }

  /**
   * Helper: draws TAG Heuer championship title partner logo across upper chest.
   */
  private static drawTagHeuerTitleLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    // Patch background with stitched gold racing border
    ctx.fillStyle = '#021810';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(x, y, w, h);

    // TAG Heuer Dual-Chevron Shield on the left
    const shieldX = x + 14;
    const shieldY = y + 8;
    const shieldW = 42;
    const shieldH = h - 16;

    // Green TAG chevron
    ctx.fillStyle = '#15803d';
    ctx.fillRect(shieldX, shieldY, shieldW, shieldH * 0.48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAG', shieldX + shieldW / 2, shieldY + 13);

    // Red HEUER chevron
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(shieldX, shieldY + shieldH * 0.48, shieldW, shieldH * 0.52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "Chakra Petch", sans-serif';
    ctx.fillText('HEUER', shieldX + shieldW / 2, shieldY + shieldH - 6);
    ctx.textAlign = 'start';

    // Official Title Partner Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText('TAG HEUER', x + 68, y + 27);

    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('OFFICIAL MOTORSPORT TIMEKEEPER & GRAND PRIX PARTNER', x + 68, y + 43);
  }

  /**
   * Helper: draws Brembo logo with official red caliper silhouette.
   */
  private static drawBremboLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#021810';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Red brake caliper emblem
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(x + 24, y + h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#021810';
    ctx.beginPath();
    ctx.arc(x + 24, y + h / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // 4 Caliper piston bolts
    ctx.fillStyle = '#ffffff';
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      ctx.fillRect(x + 24 + Math.cos(ang) * 10 - 1.5, y + h / 2 + Math.sin(ang) * 10 - 1.5, 3, 3);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Chakra Petch", sans-serif';
    ctx.fillText('brembo', x + 46, y + 30);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('RACING BRAKES', x + 48, y + 44);
  }

  /**
   * Helper: draws Pirelli logo with elongated P and racing yellow contrast.
   */
  private static drawPirelliLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#fbbf24'; // Classic Pirelli yellow patch
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#dc2626'; // Red Pirelli lettering
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('IRELLI', x + 46, y + 36);

    // Elongated 'P' hook over the text
    ctx.fillRect(x + 16, y + 14, 9, 30);
    ctx.fillRect(x + 16, y + 14, w - 30, 7);
    ctx.beginPath();
    ctx.arc(x + 34, y + 23, 9, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    ctx.font = 'bold 7px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('OFFICIAL F1 TYRE SUPPLIER', x + 24, y + 49);
  }

  /**
   * Helper: draws Sparco official racing equipment crest.
   */
  private static drawSparcoLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#021810';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x, y, w, h);

    // Sparco Blue Racing Oval
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(x + 22, y + 26, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic bold 18px "Chakra Petch", sans-serif';
    ctx.fillText('sparco', x + 42, y + 32);

    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('RACING SAFETY EQUIPMENT', x + 16, y + 54);
  }

  /**
   * Helper: draws Shell V-Power motorsport sponsor crest.
   */
  private static drawShellLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#021810';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x, y, w, h);

    // Scallop shell icon
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 14, 0, Math.PI, true);
    ctx.lineTo(x + 26, y + 40);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 22, y + 36, 8, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.fillText('Shell', x + 50, y + 26);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('V-Power', x + 50, y + 42);

    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('RACING FUELS', x + 50, y + 54);
  }

  /**
   * Helper: draws Mobil 1 motorsport technical partner logo.
   */
  private static drawMobil1Logo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#021810';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Iconic Mobil 1 Logo: "Mobil" in blue, "1" in red
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Mobil', x + 16, y + 25);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.fillText('1', x + 76, y + 25);

    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('MOTORSPORT LUBRICANTS', x + 16, y + 36);
  }

  /**
   * Helper: draws iconic Alpinestars white racing star logo with gold core.
   */
  private static drawAlpinestarsLogo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Outer spiral ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0.4, Math.PI * 1.8);
    ctx.stroke();

    // Central star
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Helper: draws official FIA Standard 8856-2018 safety patch with gold hologram.
   */
  private static drawFiaHomologationPatch(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#0a1a12';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Gold FIA seal
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 6, y + 8, 28, h - 16);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('FIA', x + 10, y + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    ctx.fillText('STANDARD 8856-2018', x + 40, y + 20);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#a3e635';
    ctx.fillText('HOMOLOGATION: RS.342.24', x + 40, y + 34);
  }

  /**
   * Helper: draws driver name, racing number and nationality flag.
   */
  private static drawDriverBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = '#031f14';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Spanish / Racing national flag
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 10, y + 10, 24, 7);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 10, y + 17, 24, 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 10, y + 27, 24, 7);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Chakra Petch", sans-serif';
    ctx.fillText('#27 L. ROSSI', x + 42, y + 25);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PRO DRIVER • BLOOD TYPE O+ POS', x + 42, y + 38);
  }

  /**
   * Helper: draws sleeve technical sponsor patches on biceps.
   */
  private static drawSleeveBadges(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    rightX: number,
    y: number
  ): void {
    // Left Sleeve: IWC Schaffhausen
    ctx.fillStyle = '#021810';
    ctx.fillRect(leftX - 80, y, 160, 48);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(leftX - 80, y, 160, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IWC', leftX, y + 26);
    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#a3e635';
    ctx.fillText('SCHAFFHAUSEN', leftX, y + 39);

    // Right Sleeve: Bosch Motorsport
    ctx.fillStyle = '#021810';
    ctx.fillRect(rightX - 80, y, 160, 48);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rightX - 80, y, 160, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.fillText('BOSCH', rightX, y + 26);
    ctx.font = '7px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('MOTORSPORT', rightX, y + 39);
    ctx.textAlign = 'start';
  }

  /**
   * Helper: draws large back Escudería banner on upper spine.
   */
  private static drawBackBanner(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    goldAccent: string
  ): void {
    ctx.fillStyle = '#021810';
    ctx.fillRect(cx - 260, y, 520, 96);
    ctx.strokeStyle = goldAccent;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 260, y, 520, 96);

    // Decorative racing wing laurels on sides
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 240, y + 48);
    ctx.lineTo(cx - 180, y + 48);
    ctx.moveTo(cx + 180, y + 48);
    ctx.lineTo(cx + 240, y + 48);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('APEX RACING TEAM', cx, y + 48);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = goldAccent;
    ctx.fillText('OFFICIAL FORMULA 1 WORKS TEAM', cx, y + 74);
    ctx.textAlign = 'start';
  }

  /**
   * Generates a soft ground ambient occlusion shadow texture for feet.
   */
  public static getFootShadowTexture(): THREE.CanvasTexture {
    if (this.cachedFootShadowTex) return this.cachedFootShadowTex;
    if (typeof document === 'undefined') {
      return new THREE.Texture() as THREE.CanvasTexture;
    }

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.48);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.96)');
      grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.75)');
      grad.addColorStop(0.70, 'rgba(0, 0, 0, 0.28)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, size * 0.38, size * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.cachedFootShadowTex = tex;
    return tex;
  }

  /**
   * Builds the complete, anatomically sculpted racing pilot model.
   */
  public static buildAnatomicalPilot(livery?: CustomLiverySettings): ProceduralPilotRig {
    const isCustomTeam = Boolean(
      livery?.primaryColor &&
      livery.primaryColor !== '#040814' &&
      livery.primaryColor !== '#050a16' &&
      livery.primaryColor !== '#1d4ed8'
    );

    // Color references:
    // Nomex Suit: British Racing Emerald Green (#063b27) with Championship Gold Accent (#fbbf24)
    const suitColorHex = 0xffffff; // Pure white multiplier preserves crisp diffuse albedo and razor-sharp sponsor badges
    const suitPlainColorHex = 0x063b27; // Deep dark emerald green for unmapped bellows & collar
    const beltColorHex = 0x032115; // Deep dark green carbon weave
    const accentColorHex = 0xfbbf24; // F1 Championship Gold Accent
    const helmetColorHex = 0x052e1f; // Deep British Emerald Green metallic clearcoat

    const primaryGreenHexStr = isCustomTeam && livery?.primaryColor ? livery.primaryColor : '#063b27';
    const accentGoldHexStr = isCustomTeam && livery?.secondaryColor && livery.secondaryColor !== '#a3e635' ? livery.secondaryColor : '#fbbf24';

    const diffuseMap = this.getSuitDiffuseMap(primaryGreenHexStr, accentGoldHexStr);
    const normalMap = this.getSuitNormalMap();

    // -------------------------------------------------------------------------
    // MASTER PBR MATERIALS - PHYSICAL TEXTILE REALISM (NO PLASTIC SHINE)
    // -------------------------------------------------------------------------
    // 1. One-Piece Nomex Race Suit Material - Advanced Physical Fabric
    const suitMat = new THREE.MeshPhysicalMaterial({
      color: suitColorHex,
      roughness: 0.88, // Ultra-matte, eliminates plastic shine completely
      metalness: 0.02,
      map: diffuseMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      sheen: 1.0, // Physical Nomex fabric micro-fiber sheen
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x136a46), // Emerald velvet sheen at grazing angles
      specularIntensity: 0.12, // Prevents high-gloss plastic specular spots
      clearcoat: 0.0, // ZERO clearcoat on race suit fabric
    });

    // 1b. Nomex Pure Fabric Material (for bellows, inner gussets and cuffs)
    const suitPlainMat = new THREE.MeshPhysicalMaterial({
      color: suitPlainColorHex,
      roughness: 0.90,
      metalness: 0.02,
      sheen: 0.90,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x105c3d),
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
    });

    // 2. Ribbed Belt & Elastic Trim
    const beltMat = new THREE.MeshPhysicalMaterial({
      color: beltColorHex,
      roughness: 0.75,
      metalness: 0.04,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });

    // 3. FIA Deep Metallic Racing Green Helmet Shell (Automotive Clearcoat finish)
    const helmetMat = new THREE.MeshPhysicalMaterial({
      color: helmetColorHex,
      roughness: 0.12,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.95,
    });

    // 4. Electric-Blue Chrome Mirrored Visor (Sky & circuit reflection)
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x00c8ff,
      roughness: 0.02,
      metalness: 0.98,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
    });

    // 5. Deep Racing Green Competition Racing Boots (Anatomical Upper)
    const bootUpperMat = new THREE.MeshStandardMaterial({
      color: helmetColorHex,
      roughness: 0.42,
      metalness: 0.20,
    });

    // 5b. Competition Racing Boot Grippy Siped Rubber Sole
    const bootSoleMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.92,
      metalness: 0.02,
    });

    // 5c. Carbon Fiber Heel Counter / Abrasion Guard
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111114,
      roughness: 0.30,
      metalness: 0.60,
    });

    // 6. Deep Green Technical Nomex Gloves
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x072b1d,
      roughness: 0.76,
      metalness: 0.06,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });

    // 6b. Glove Knuckle Armor & Silicone Grip
    const knucklePadMat = new THREE.MeshStandardMaterial({
      color: 0x15221b,
      roughness: 0.32,
      metalness: 0.40,
    });

    const siliconeGripMat = new THREE.MeshStandardMaterial({
      color: accentColorHex,
      roughness: 0.20,
      metalness: 0.10,
    });

    // 7. Accent Trim / Seam Piping (Electric F1 Lime Green)
    const pipingMat = new THREE.MeshStandardMaterial({
      color: accentColorHex,
      roughness: 0.45,
      metalness: 0.15,
    });

    const pilotRoot = new THREE.Group();
    pilotRoot.name = 'AnatomicalRacingPilot';

    // -------------------------------------------------------------------------
    // 1. SCULPTED ANATOMICAL TORSO & CHEST
    // -------------------------------------------------------------------------
    const torso = new THREE.Group();
    torso.position.set(0, 0.96, 0);

    // Anatomical Athletic Torso (Trapezius, Pectorals, Latissimus Dorsi, Waist Taper)
    // We construct a multi-segment lathe geometry starting at -PI/2 so U=0.5 (center) aligns dead-center on +Z (Chest)
    const torsoPoints: THREE.Vector2[] = [
      new THREE.Vector2(0.158, -0.09), // Deep internal waist sleeve extending into pelvis
      new THREE.Vector2(0.162, -0.04), // Lower waist internal transition
      new THREE.Vector2(0.166, 0.0),   // Waistline (seamlessly continuous with trousers)
      new THREE.Vector2(0.178, 0.08),  // Lower Abdomen
      new THREE.Vector2(0.202, 0.20),  // Ribcage / Lats
      new THREE.Vector2(0.228, 0.34),  // Upper Pectorals / Clavicle
      new THREE.Vector2(0.240, 0.41),  // Seamless Shoulder Slope
      new THREE.Vector2(0.185, 0.46),  // Natural Trapezius Contour
      new THREE.Vector2(0.090, 0.48),  // Neck base
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 32, -Math.PI / 2, Math.PI * 2);
    torsoGeo.scale(1.05, 1.0, 0.72); // Flatten front-to-back for realistic athletic human cross-section
    torsoGeo.computeVertexNormals();

    const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
    torsoMesh.castShadow = true;
    torso.add(torsoMesh);

    // Central Concealed Zipper Storm Flap with 3D Depth
    const zipGeo = new THREE.BoxGeometry(0.038, 0.46, 0.018);
    const zipMesh = new THREE.Mesh(zipGeo, beltMat);
    zipMesh.position.set(0, 0.24, 0.138);
    zipMesh.castShadow = true;
    torso.add(zipMesh);

    // High Nomex Stand-Up Collar with Ergonomic Neck Curve
    const collarGeo = new THREE.CylinderGeometry(0.085, 0.094, 0.090, 24);
    const collarMesh = new THREE.Mesh(collarGeo, beltMat);
    collarMesh.position.set(0, 0.48, -0.01);
    collarMesh.castShadow = true;
    torso.add(collarMesh);

    // Collar Velcro Closure Tab
    const collarTabGeo = new THREE.BoxGeometry(0.048, 0.032, 0.016);
    const collarTabMesh = new THREE.Mesh(collarTabGeo, beltMat);
    collarTabMesh.position.set(0.045, 0.48, 0.088);
    torso.add(collarTabMesh);

    // FIA Rescue Extraction Straps: Flat low-profile woven webbing sewn directly onto shoulder seam
    // Unlike bulky plates or superimposed pieces, these are 2mm flat Nomex straps integrated into the suit
    const createExtractionEpaulet = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const epaulet = new THREE.Group();
      epaulet.position.set(sign * 0.205, 0.435, 0);

      // Flat reinforced Nomex webbing strap (3.2cm wide, 15cm long, 3mm thick)
      const strapGeo = new THREE.BoxGeometry(0.034, 0.005, 0.15);
      const strapMesh = new THREE.Mesh(strapGeo, beltMat);
      strapMesh.rotation.z = sign * 0.18;
      epaulet.add(strapMesh);

      // Contrast electric lime border piping sewn flush into the suit
      const pipeGeo = new THREE.BoxGeometry(0.006, 0.006, 0.15);
      const pipeMesh = new THREE.Mesh(pipeGeo, pipingMat);
      pipeMesh.position.set(sign * 0.018, 0.001, 0);
      pipeMesh.rotation.z = sign * 0.18;
      epaulet.add(pipeMesh);

      return epaulet;
    };

    torso.add(createExtractionEpaulet(true));
    torso.add(createExtractionEpaulet(false));

    // -------------------------------------------------------------------------
    // 2. FIA 8860-2018 AERODYNAMIC RACING HELMET (PRECISION OPTICAL SHIELD)
    // -------------------------------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.48, 0);

    // Inner Nomex Balaclava / Neck Seal
    const neckGeo = new THREE.CylinderGeometry(0.072, 0.082, 0.10, 24);
    const neckMesh = new THREE.Mesh(neckGeo, suitPlainMat);
    neckMesh.position.set(0, 0.04, 0);
    head.add(neckMesh);

    // Aerodynamic Shell: Sculpted with prominent forward chin bar
    const helmetGeo = new THREE.SphereGeometry(0.165, 36, 32);
    helmetGeo.scale(0.96, 1.10, 1.15); // Aggressive oval aerodynamic form factor
    helmetGeo.computeVertexNormals();
    const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
    helmetMesh.position.set(0, 0.20, -0.012);
    helmetMesh.castShadow = true;
    head.add(helmetMesh);

    // Aerodynamic Chin Bar: Smooth front flow deflection seamlessly integrated
    const chinBarGeo = new THREE.CylinderGeometry(0.142, 0.148, 0.082, 32, 1, false, -Math.PI * 0.32, Math.PI * 0.64);
    chinBarGeo.scale(1.0, 1.0, 1.15);
    chinBarGeo.computeVertexNormals();
    const chinBarMesh = new THREE.Mesh(chinBarGeo, helmetMat);
    chinBarMesh.position.set(0, 0.125, 0.024);
    chinBarMesh.castShadow = true;
    head.add(chinBarMesh);

    // Front Mesh Air Dam Intake Vents (Boca de ventilación frontal con rejilla)
    const chinVentGeo = new THREE.BoxGeometry(0.076, 0.024, 0.024);
    const chinVentMesh = new THREE.Mesh(chinVentGeo, knucklePadMat);
    chinVentMesh.position.set(0, 0.125, 0.180);
    head.add(chinVentMesh);

    // Visor Eyeport Rubber Gasket Frame (recessed matte black seal framing eye aperture)
    // Note: openEnded = true completely eliminates wedge caps and internal clipping artifacts!
    const eyeportGasketGeo = new THREE.CylinderGeometry(
      0.166, 0.166, 0.086, 36, 1, true, -Math.PI * 0.38, Math.PI * 0.76
    );
    const eyeportGasket = new THREE.Mesh(eyeportGasketGeo, knucklePadMat);
    eyeportGasket.position.set(0, 0.205, 0.016);
    head.add(eyeportGasket);

    // Visor: Cylindrical optical shield with openEnded = TRUE
    // Completely eliminates pie slices, interior walls, and distorted reflection triangles
    const visorGeo = new THREE.CylinderGeometry(
      0.168, 0.168, 0.076, 36, 1, true, -Math.PI * 0.36, Math.PI * 0.72
    );
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.205, 0.016);
    head.add(visorMesh);

    // Zylon Anti-Penetration Upper Visor Strip (Mandated by FIA Standard 8860) with openEnded = TRUE
    const zylonGeo = new THREE.CylinderGeometry(
      0.170, 0.170, 0.018, 36, 1, true, -Math.PI * 0.36, Math.PI * 0.72
    );
    const zylonMesh = new THREE.Mesh(zylonGeo, knucklePadMat);
    zylonMesh.position.set(0, 0.244, 0.016);
    head.add(zylonMesh);

    // Central FIA Visor Locking Mechanism
    const lockGeo = new THREE.BoxGeometry(0.014, 0.010, 0.010);
    const lockMesh = new THREE.Mesh(lockGeo, pipingMat);
    lockMesh.position.set(0, 0.166, 0.185);
    head.add(lockMesh);

    // Visor Tear-Off Post Locators (Left & Right)
    const createTearOffPost = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const postGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 12);
      const postMesh = new THREE.Mesh(postGeo, knucklePadMat);
      postMesh.position.set(sign * 0.128, 0.205, 0.125);
      postMesh.rotation.z = Math.PI / 2;
      return postMesh;
    };
    head.add(createTearOffPost(true));
    head.add(createTearOffPost(false));

    // Precision Visor Pivot Mechanisms with Anodized Screws
    const createVisorPivot = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const pivot = new THREE.Group();
      pivot.position.set(sign * 0.158, 0.205, 0.040);

      const baseGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.005, 20);
      const baseMesh = new THREE.Mesh(baseGeo, knucklePadMat);
      baseMesh.rotation.z = Math.PI / 2;
      pivot.add(baseMesh);

      const screwGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.007, 16);
      const screwMesh = new THREE.Mesh(screwGeo, pipingMat);
      screwMesh.rotation.z = Math.PI / 2;
      pivot.add(screwMesh);

      return pivot;
    };
    head.add(createVisorPivot(true));
    head.add(createVisorPivot(false));

    // Anodized Aluminum HANS Anchors (Head and Neck Support studs on lower rear)
    const createHansPost = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const hansGeo = new THREE.CylinderGeometry(0.010, 0.012, 0.016, 14);
      const hansMesh = new THREE.Mesh(hansGeo, pipingMat);
      hansMesh.position.set(sign * 0.145, 0.12, -0.09);
      hansMesh.rotation.z = sign * (Math.PI / 2 - 0.2);
      return hansMesh;
    };
    head.add(createHansPost(true));
    head.add(createHansPost(false));

    // Top Air Scoop Ventilation Chimneys
    const topScoopGeo = new THREE.BoxGeometry(0.024, 0.016, 0.070);
    const topScoopL = new THREE.Mesh(topScoopGeo, knucklePadMat);
    topScoopL.position.set(-0.046, 0.355, 0.02);
    head.add(topScoopL);

    const topScoopR = topScoopL.clone();
    topScoopR.position.x = 0.046;
    head.add(topScoopR);

    // Rear Ducktail Aerodynamic Spoiler
    const spoilerGeo = new THREE.BoxGeometry(0.18, 0.024, 0.070);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, helmetMat);
    spoilerMesh.position.set(0, 0.175, -0.165);
    spoilerMesh.rotation.x = -0.34;
    head.add(spoilerMesh);

    torso.add(head);

    // -------------------------------------------------------------------------
    // 3. ARTICULATED ARMS & ANATOMICAL GLOVES (UNIFIED ONE-PIECE SUIT)
    // -------------------------------------------------------------------------
    const createArmChain = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const shoulderJoint = new THREE.Group();
      // Shoulder pivot sits cleanly at the natural armhole without bulging or overlapping
      shoulderJoint.position.set(sign * 0.245, 0.385, 0);

      // Continuous Upper Arm Nomex Sleeve with athletic muscular contour
      const upperArmGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.27, 24);
      upperArmGeo.scale(1.04, 1.0, 0.96);
      upperArmGeo.computeVertexNormals();
      const upperArmMesh = new THREE.Mesh(upperArmGeo, suitMat);
      upperArmMesh.position.y = -0.135;
      upperArmMesh.castShadow = true;
      shoulderJoint.add(upperArmMesh);

      // Concealed internal hinge ball (recessed inside armhole, never protrudes as a separate piece)
      const internalPivotGeo = new THREE.SphereGeometry(0.056, 18, 16);
      const internalPivotMesh = new THREE.Mesh(internalPivotGeo, suitPlainMat);
      shoulderJoint.add(internalPivotMesh);

      // Elbow Joint: sleek continuous transition to forearm
      const elbowJoint = new THREE.Group();
      elbowJoint.position.set(0, -0.27, 0);

      const elbowPivotGeo = new THREE.SphereGeometry(0.046, 18, 16);
      const elbowPivotMesh = new THREE.Mesh(elbowPivotGeo, suitPlainMat);
      elbowJoint.add(elbowPivotMesh);

      // Forearm Nomex Sleeve with natural muscle taper to wrist
      const forearmGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.24, 24);
      forearmGeo.scale(1.05, 1.0, 0.94);
      forearmGeo.computeVertexNormals();
      const forearmMesh = new THREE.Mesh(forearmGeo, suitMat);
      forearmMesh.position.y = -0.12;
      forearmMesh.castShadow = true;
      elbowJoint.add(forearmMesh);

      // Gathered Elastic Wrist Cuff with Velcro Cinch Tab
      const wristCuffGeo = new THREE.CylinderGeometry(0.045, 0.042, 0.038, 22);
      const wristCuffMesh = new THREE.Mesh(wristCuffGeo, beltMat);
      wristCuffMesh.position.y = -0.22;
      elbowJoint.add(wristCuffMesh);

      // Wrist Joint & Anatomical 5-Finger Racing Glove
      // Base orientation: natural human semi-pronation (~49° inward rotation)
      // Dorsal knuckles face outward laterally; palm faces inward toward thighs; thumb faces forward
      const wristJoint = new THREE.Group();
      wristJoint.position.set(0, -0.24, 0);
      const baseSemiPronationY = isLeft ? -0.85 : 0.85;
      wristJoint.rotation.y = baseSemiPronationY;

      // Hand Palm & Dorsal Plate (Ergonomic hand core)
      const handCoreGeo = new THREE.BoxGeometry(0.062, 0.082, 0.044);
      const handCoreMesh = new THREE.Mesh(handCoreGeo, gloveMat);
      handCoreMesh.position.set(0, -0.041, 0.006);
      handCoreMesh.castShadow = true;
      wristJoint.add(handCoreMesh);

      // Molded Carbon/Composite Knuckle Shield across Metacarpals (facing outward on +Z local)
      const knuckleShieldGeo = new THREE.BoxGeometry(0.060, 0.024, 0.018);
      const knuckleShieldMesh = new THREE.Mesh(knuckleShieldGeo, knucklePadMat);
      knuckleShieldMesh.position.set(0, -0.032, 0.026);
      wristJoint.add(knuckleShieldMesh);

      // Individual Knuckle Ridge Accents (4 distinct knuckles)
      for (let k = -1.5; k <= 1.5; k += 1.0) {
        const kDotGeo = new THREE.SphereGeometry(0.006, 8, 8);
        const kDotMesh = new THREE.Mesh(kDotGeo, siliconeGripMat);
        kDotMesh.position.set(k * 0.014, -0.032, 0.034);
        wristJoint.add(kDotMesh);
      }

      // Silicone Palm Grip Strip (on inner -Z local facing towards thigh)
      const palmGripGeo = new THREE.BoxGeometry(0.048, 0.054, 0.004);
      const palmGripMesh = new THREE.Mesh(palmGripGeo, siliconeGripMat);
      palmGripMesh.position.set(0, -0.048, -0.017);
      wristJoint.add(palmGripMesh);

      // --- 5 ANATOMICAL ARTICULATED FINGERS IN NATURAL RESTING GAIT CURL ---

      // 1. Ergonomic Angled Thumb (Opposable thumb positioned on anterior/radial edge)
      const thumbRoot = new THREE.Group();
      const thumbLocalX = isLeft ? 0.024 : -0.024;
      thumbRoot.position.set(thumbLocalX, -0.032, 0.016);
      thumbRoot.rotation.set(0.35, isLeft ? -0.40 : 0.40, isLeft ? -0.30 : 0.30);

      const thumbP1Geo = new THREE.CylinderGeometry(0.010, 0.009, 0.032, 12);
      const thumbP1Mesh = new THREE.Mesh(thumbP1Geo, gloveMat);
      thumbP1Mesh.position.y = -0.016;
      thumbRoot.add(thumbP1Mesh);

      const thumbP2Geo = new THREE.CylinderGeometry(0.009, 0.007, 0.028, 12);
      const thumbP2Mesh = new THREE.Mesh(thumbP2Geo, gloveMat);
      thumbP2Mesh.position.set(0, -0.042, 0.006);
      thumbP2Mesh.rotation.x = 0.35;
      thumbRoot.add(thumbP2Mesh);

      // Thumb silicone grip pad
      const thumbGripGeo = new THREE.BoxGeometry(0.008, 0.020, 0.003);
      const thumbGripMesh = new THREE.Mesh(thumbGripGeo, siliconeGripMat);
      thumbGripMesh.position.set(0, -0.030, -0.007);
      thumbRoot.add(thumbGripMesh);

      wristJoint.add(thumbRoot);

      // Helper function to create an articulated 3-phalanx finger
      const createFinger = (
        xOffset: number,
        zOffset: number,
        baseLength: number,
        fingerRadius: number,
        curlFactor: number
      ) => {
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(xOffset, -0.078, zOffset);

        // Proximal phalanx (angled naturally toward palm in gait curl)
        const p1Geo = new THREE.CylinderGeometry(fingerRadius, fingerRadius * 0.92, baseLength * 0.44, 10);
        const p1Mesh = new THREE.Mesh(p1Geo, gloveMat);
        p1Mesh.position.y = -baseLength * 0.22;
        p1Mesh.rotation.x = curlFactor * 0.25;
        fingerGroup.add(p1Mesh);

        // Middle phalanx
        const p2Geo = new THREE.CylinderGeometry(fingerRadius * 0.92, fingerRadius * 0.85, baseLength * 0.34, 10);
        const p2Mesh = new THREE.Mesh(p2Geo, gloveMat);
        p2Mesh.position.set(0, -baseLength * 0.50, 0.008 * curlFactor);
        p2Mesh.rotation.x = curlFactor * 0.55;
        fingerGroup.add(p2Mesh);

        // Distal phalanx & fingertip
        const p3Geo = new THREE.CylinderGeometry(fingerRadius * 0.85, fingerRadius * 0.70, baseLength * 0.28, 10);
        const p3Mesh = new THREE.Mesh(p3Geo, gloveMat);
        p3Mesh.position.set(0, -baseLength * 0.72, 0.020 * curlFactor);
        p3Mesh.rotation.x = curlFactor * 0.85;
        fingerGroup.add(p3Mesh);

        // Silicone grip dot on inner pad
        const gripGeo = new THREE.BoxGeometry(fingerRadius * 1.2, baseLength * 0.35, 0.002);
        const gripMesh = new THREE.Mesh(gripGeo, siliconeGripMat);
        gripMesh.position.set(0, -baseLength * 0.40, -fingerRadius * 0.95);
        fingerGroup.add(gripMesh);

        return fingerGroup;
      };

      // 4 Anatomical fingers spanning from radial/anterior to ulnar/posterior
      const fingerSign = isLeft ? 1 : -1;
      // 2. Index finger (anterior, near thumb)
      wristJoint.add(createFinger(fingerSign * 0.018, 0.008, 0.052, 0.0085, 0.95));
      // 3. Middle finger (longest finger)
      wristJoint.add(createFinger(fingerSign * 0.006, 0.004, 0.058, 0.0090, 1.05));
      // 4. Ring finger
      wristJoint.add(createFinger(fingerSign * -0.006, 0.000, 0.054, 0.0085, 1.15));
      // 5. Pinky finger (posterior, tucked in)
      wristJoint.add(createFinger(fingerSign * -0.018, -0.004, 0.044, 0.0075, 1.25));

      elbowJoint.add(wristJoint);
      shoulderJoint.add(elbowJoint);

      return { shoulderJoint, elbowJoint, wristJoint };
    };

    const leftArm = createArmChain(true);
    const rightArm = createArmChain(false);
    torso.add(leftArm.shoulderJoint, rightArm.shoulderJoint);

    // -------------------------------------------------------------------------
    // 4. PELVIS, WAIST BELT & CONTINUOUS LEGS
    // -------------------------------------------------------------------------
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 0.95, 0);

    // Integrated Elastic Waist Belt Band (Reinforced seamless overlap with torso sleeve)
    const beltGeo = new THREE.CylinderGeometry(0.180, 0.174, 0.115, 28);
    beltGeo.scale(1.06, 1.0, 0.72);
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.position.set(0, 0.02, 0);
    beltMesh.castShadow = true;
    pelvis.add(beltMesh);

    // Central Belt Fastener Flap with Velcro tab & FIA embroidery crest
    const buckleGeo = new THREE.BoxGeometry(0.056, 0.088, 0.024);
    const buckleMesh = new THREE.Mesh(buckleGeo, beltMat);
    buckleMesh.position.set(0, 0.02, 0.128);
    pelvis.add(buckleMesh);

    // Lumbar Elastic Stretch Accordion Panel (Espalda baja elástica)
    const lumbarGeo = new THREE.BoxGeometry(0.25, 0.096, 0.022);
    const lumbarMesh = new THREE.Mesh(lumbarGeo, suitPlainMat);
    lumbarMesh.position.set(0, 0.02, -0.120);
    pelvis.add(lumbarMesh);

    // Pelvic Trouser Seat / Groin Saddle
    const pelvisGeo = new THREE.CylinderGeometry(0.176, 0.158, 0.22, 26);
    pelvisGeo.scale(1.06, 1.0, 0.72);
    pelvisGeo.computeVertexNormals();
    const pelvisMesh = new THREE.Mesh(pelvisGeo, suitMat);
    pelvisMesh.position.set(0, -0.09, 0);
    pelvisMesh.castShadow = true;
    pelvis.add(pelvisMesh);

    // Inner Crotch & Groin Stretch Gusset (Unifies both perneras, eliminating void)
    const crotchGeo = new THREE.SphereGeometry(0.094, 20, 16);
    crotchGeo.scale(1.10, 0.60, 0.85);
    const crotchMesh = new THREE.Mesh(crotchGeo, suitPlainMat);
    crotchMesh.position.set(0, -0.13, 0);
    pelvis.add(crotchMesh);

    // -------------------------------------------------------------------------
    // 5. ARTICULATED LEGS & ERGONOMIC RACING BOOTS
    // -------------------------------------------------------------------------
    const createLegChain = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const hipJoint = new THREE.Group();
      hipJoint.position.set(sign * 0.125, -0.11, 0);

      // Hip Sleeve Ball inside trouser groin
      const hipBallGeo = new THREE.SphereGeometry(0.086, 22, 20);
      const hipBallMesh = new THREE.Mesh(hipBallGeo, suitMat);
      hipJoint.add(hipBallMesh);

      // Thigh Pant Sleeve (Athletic racing trousers with authentic drape)
      const thighGeo = new THREE.CylinderGeometry(0.086, 0.070, 0.38, 24);
      thighGeo.scale(1.05, 1.0, 0.95);
      thighGeo.computeVertexNormals();
      const thighMesh = new THREE.Mesh(thighGeo, suitMat);
      thighMesh.position.y = -0.19;
      thighMesh.castShadow = true;
      hipJoint.add(thighMesh);

      // Natural cloth drape ring on mid-thigh
      const thighDrapeGeo = new THREE.TorusGeometry(0.078, 0.008, 12, 20);
      const thighDrapeMesh = new THREE.Mesh(thighDrapeGeo, suitPlainMat);
      thighDrapeMesh.position.y = -0.22;
      thighDrapeMesh.rotation.x = Math.PI / 2;
      hipJoint.add(thighDrapeMesh);

      // Knee Joint with 3-Stage Accordion Stretch Flexion Pleats
      const kneeJoint = new THREE.Group();
      kneeJoint.position.set(0, -0.38, 0);

      const kneeBallGeo = new THREE.SphereGeometry(0.072, 22, 20);
      const kneeBallMesh = new THREE.Mesh(kneeBallGeo, suitPlainMat);
      kneeJoint.add(kneeBallMesh);

      for (let p = -1; p <= 1; p++) {
        const kneePleatGeo = new THREE.TorusGeometry(0.066, 0.009, 12, 20, Math.PI);
        const kneePleatMesh = new THREE.Mesh(kneePleatGeo, suitPlainMat);
        kneePleatMesh.position.set(0, p * 0.022, 0.016);
        kneePleatMesh.rotation.y = Math.PI / 2;
        kneeJoint.add(kneePleatMesh);
      }

      // Calf / Shin Pant Sleeve (Tapering gracefully towards ankle cuff)
      const shinGeo = new THREE.CylinderGeometry(0.071, 0.058, 0.38, 24);
      shinGeo.scale(1.04, 1.0, 0.96);
      shinGeo.computeVertexNormals();
      const shinMesh = new THREE.Mesh(shinGeo, suitMat);
      shinMesh.position.y = -0.19;
      shinMesh.castShadow = true;
      kneeJoint.add(shinMesh);

      // Gathered Elastic Ankle Cuff
      const ankleCuffGeo = new THREE.CylinderGeometry(0.063, 0.058, 0.048, 20);
      const ankleCuffMesh = new THREE.Mesh(ankleCuffGeo, beltMat);
      ankleCuffMesh.position.y = -0.36;
      kneeJoint.add(ankleCuffMesh);

      // Ankle Joint & Ergonomic Alpinestars Supermono Competition Racing Boot
      const ankleJoint = new THREE.Group();
      ankleJoint.position.set(0, -0.38, 0);

      // --- ERGONOMIC COMPETITION RACING BOOT (NON-LEGO SCULPTED PROFILE) ---
      const bootGroup = new THREE.Group();

      // 1. Padded Ankle Shaft Collar with rear Achilles tendon notch
      const collarShaftGeo = new THREE.CylinderGeometry(0.054, 0.052, 0.075, 22);
      collarShaftGeo.scale(0.92, 1.0, 1.10);
      const collarShaftMesh = new THREE.Mesh(collarShaftGeo, bootUpperMat);
      collarShaftMesh.position.set(0, 0.015, 0.01);
      bootGroup.add(collarShaftMesh);

      // Soft padded collar rim around top of ankle
      const collarRimGeo = new THREE.TorusGeometry(0.050, 0.008, 10, 20);
      const collarRimMesh = new THREE.Mesh(collarRimGeo, beltMat);
      collarRimMesh.position.set(0, 0.050, 0.01);
      collarRimMesh.rotation.x = Math.PI / 2;
      bootGroup.add(collarRimMesh);

      // 2. Sculpted Footbed & Forefoot Core (Slender, aerodynamic racing contour)
      // Tapered: narrow heel (0.076), narrow arch waist (0.072), wider ball (0.092), rounded toe box
      const footbedPoints: THREE.Vector3[] = [];
      const footProfile = [
        { z: -0.09, w: 0.074, h: 0.080, y: -0.05 }, // Heel
        { z: -0.03, w: 0.070, h: 0.088, y: -0.04 }, // Arch / Instep base
        { z: 0.04,  w: 0.088, h: 0.078, y: -0.05 }, // Ball of foot (metatarsals)
        { z: 0.11,  w: 0.082, h: 0.056, y: -0.06 }, // Forefoot
        { z: 0.155, w: 0.058, h: 0.038, y: -0.07 }, // Tapered rounded toe tip
      ];

      // Build organic lofted foot envelope
      const footGeo = new THREE.BoxGeometry(0.090, 0.095, 0.245, 4, 3, 6);
      const posAttr = footGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);

        // Normalize z along boot length [-0.12, 0.12]
        const zNorm = (z + 0.12) / 0.24; // 0 = heel, 1 = toe

        // Narrowing curve for heel and toe rocker
        let widthScale = 1.0;
        let heightScale = 1.0;

        if (zNorm < 0.25) {
          // Heel counter
          widthScale = 0.88;
        } else if (zNorm < 0.50) {
          // Arch waist
          widthScale = 0.82;
        } else if (zNorm < 0.80) {
          // Metatarsal ball
          widthScale = 1.04;
        } else {
          // Tapered toe box
          widthScale = Math.max(0.55, 1.04 - (zNorm - 0.80) * 2.2);
          heightScale = Math.max(0.48, 1.0 - (zNorm - 0.75) * 1.8);
        }

        posAttr.setX(i, x * widthScale);
        posAttr.setY(i, y * heightScale);
      }
      footGeo.computeVertexNormals();

      const footMesh = new THREE.Mesh(footGeo, bootUpperMat);
      footMesh.position.set(0, -0.046, 0.032);
      footMesh.castShadow = true;
      bootGroup.add(footMesh);

      // 3. Ergonomic Speed-Lacing Panel & Asymmetrical Instep Tongue
      const tongueGeo = new THREE.BoxGeometry(0.036, 0.080, 0.120);
      const tongueMesh = new THREE.Mesh(tongueGeo, beltMat);
      tongueMesh.position.set(0, -0.022, 0.075);
      tongueMesh.rotation.x = 0.32;
      bootGroup.add(tongueMesh);

      // Metallic speed-lace eyelet bars
      for (let l = 0; l < 4; l++) {
        const laceGeo = new THREE.BoxGeometry(0.032, 0.006, 0.008);
        const laceMesh = new THREE.Mesh(laceGeo, pipingMat);
        laceMesh.position.set(0, -0.010 - l * 0.016, 0.055 + l * 0.018);
        laceMesh.rotation.x = 0.32;
        bootGroup.add(laceMesh);
      }

      // 4. Carbon Fiber Heel Counter / Achilles Stabilizer
      const carbonHeelGeo = new THREE.SphereGeometry(0.048, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
      carbonHeelGeo.scale(0.85, 1.15, 0.95);
      const carbonHeelMesh = new THREE.Mesh(carbonHeelGeo, carbonMat);
      carbonHeelMesh.position.set(0, -0.042, -0.065);
      carbonHeelMesh.rotation.x = Math.PI * 0.45;
      bootGroup.add(carbonHeelMesh);

      // 5. Lateral Pinky-Toe Rubber Scuff Guard (Outer abrasion guard)
      const scuffGeo = new THREE.BoxGeometry(0.014, 0.024, 0.065);
      const scuffMesh = new THREE.Mesh(scuffGeo, knucklePadMat);
      scuffMesh.position.set(sign * 0.044, -0.076, 0.082);
      bootGroup.add(scuffMesh);

      // 6. Ultra-Thin Siped Rubber Sole with Rounded Pedal-Pivot Heel & Upward Toe Rocker
      // The rounded heel is the trademark signature of authentic race car driving shoes!
      const soleGeo = new THREE.BoxGeometry(0.094, 0.016, 0.252, 4, 1, 6);
      const solePos = soleGeo.attributes.position;
      for (let i = 0; i < solePos.count; i++) {
        const sx = solePos.getX(i);
        const sy = solePos.getY(i);
        const sz = solePos.getZ(i);
        const sNorm = (sz + 0.126) / 0.252; // 0 = heel, 1 = toe

        let wScale = 1.0;
        let yShift = 0.0;

        if (sNorm < 0.20) {
          // Rounded heel rocker (curving up for pedal pivot)
          wScale = 0.86;
          yShift = (1.0 - sNorm / 0.20) * 0.008;
        } else if (sNorm < 0.45) {
          // Arch waist taper
          wScale = 0.82;
        } else if (sNorm > 0.80) {
          // Toe rocker: bends gently upward for natural walking toe-off roll
          wScale = Math.max(0.60, 1.0 - (sNorm - 0.80) * 1.8);
          yShift = (sNorm - 0.80) * 0.012;
        }

        solePos.setX(i, sx * wScale);
        solePos.setY(i, sy + yShift);
      }
      soleGeo.computeVertexNormals();

      const soleMesh = new THREE.Mesh(soleGeo, bootSoleMat);
      soleMesh.position.set(0, -0.106, 0.032);
      soleMesh.castShadow = true;
      bootGroup.add(soleMesh);

      ankleJoint.add(bootGroup);
      kneeJoint.add(ankleJoint);
      hipJoint.add(kneeJoint);

      return { hipJoint, kneeJoint, ankleJoint };
    };

    const leftLeg = createLegChain(true);
    const rightLeg = createLegChain(false);
    pelvis.add(leftLeg.hipJoint, rightLeg.hipJoint);

    pilotRoot.add(torso, pelvis);

    // -------------------------------------------------------------------------
    // 6. AMBIENT OCCLUSION GROUND CONTACT FOOT SHADOWS
    // -------------------------------------------------------------------------
    const shadowTex = this.getFootShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(0.18, 0.36);
    shadowGeo.rotateX(-Math.PI / 2);

    const createFootShadow = (xOffset: number) => {
      const mat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const shadow = new THREE.Mesh(shadowGeo, mat);
      shadow.position.set(xOffset, 0.003, 0);
      return shadow;
    };

    const leftFootShadow = createFootShadow(-0.125);
    const rightFootShadow = createFootShadow(0.125);
    pilotRoot.add(leftFootShadow, rightFootShadow);

    return {
      root: pilotRoot,
      torso,
      head,
      pelvis,
      leftShoulder: leftArm.shoulderJoint,
      leftElbow: leftArm.elbowJoint,
      leftWrist: leftArm.wristJoint,
      rightShoulder: rightArm.shoulderJoint,
      rightElbow: rightArm.elbowJoint,
      rightWrist: rightArm.wristJoint,
      leftHip: leftLeg.hipJoint,
      leftKnee: leftLeg.kneeJoint,
      leftAnkle: leftLeg.ankleJoint,
      rightHip: rightLeg.hipJoint,
      rightKnee: rightLeg.kneeJoint,
      rightAnkle: rightLeg.ankleJoint,
      leftFootShadow,
      rightFootShadow,
    };
  }
}
