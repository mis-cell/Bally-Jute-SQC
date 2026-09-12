// Bally Jute Company Limited - Forms 1 to 36 Definitions

export interface FormFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'time' | 'readonly';
  unit?: string;
  defaultValue?: any;
  options?: string[];
  required?: boolean;
  helpText?: string;
}

export interface ReadingColDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'readonly';
  unit?: string;
  precision?: number;
  width?: string;
  options?: string[];
  required?: boolean;
}

export interface FormMetadata {
  code: string;
  number: number;
  title: string;
  department: string;
  departmentCode: string;
  section: string;
  sampleUnit: string;
  defaultRowCount: number;
  description: string;
  sourceStandardText: string;
  fields: FormFieldDef[];
  columns: ReadingColDef[];
  hasMoistureCorrection?: boolean;
  calculate: (formData: Record<string, any>, rows: Record<string, any>[], standards?: any) => {
    metrics: Record<string, any>;
    result: 'PASS' | 'WARNING' | 'FAIL';
    summaryHtml?: string;
  };
}

// Math helpers
export function calcMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function calcStdDev(arr: number[], mean?: number): number {
  if (arr.length <= 1) return 0;
  const m = mean !== undefined ? mean : calcMean(arr);
  const sumSquares = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0);
  return Math.sqrt(sumSquares / (arr.length - 1));
}

export function calcCV(arr: number[]): number {
  const m = calcMean(arr);
  if (m === 0) return 0;
  const s = calcStdDev(arr, m);
  return (s / m) * 100;
}

export function calcRange(arr: number[]): { min: number; max: number; range: number } {
  if (arr.length === 0) return { min: 0, max: 0, range: 0 };
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return { min, max, range: max - min };
}

export function moistureCorrect(observedWeight: number, observedMR: number, standardMR: number): number {
  if (100 + observedMR <= 0) return observedWeight;
  return (observedWeight * (100 + standardMR)) / (100 + observedMR);
}

export const FORM_REGISTRY: Record<string, FormMetadata> = {
  'FORM-01': {
    code: 'FORM-01',
    number: 1,
    title: 'Selection – Checking of Morrah Weight',
    department: 'Selection',
    departmentCode: 'SEL',
    section: 'Raw Jute Selection',
    sampleUnit: 'kg',
    defaultRowCount: 10,
    description: '10 Morrah weight readings taken at selection. Calculates Average Weight, Range, and C.V.%.',
    sourceStandardText: 'Standard Morrah Weight: 1.50 kg to 2.25 kg depending on grade. Standard C.V.%: Max 8.0%.',
    fields: [
      { key: 'batchNo', label: 'Batch No.', type: 'text', required: true },
      { key: 'selectorName', label: 'Selector Name', type: 'text', required: true },
      { key: 'lotNo', label: 'Lot / Mark No.', type: 'text' },
      { key: 'nominalWeightKg', label: 'Target Morrah Weight (kg)', type: 'number', defaultValue: 1.80, unit: 'kg' },
      { key: 'maxCvPct', label: 'Max Permissible C.V.%', type: 'number', defaultValue: 8.0, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'morrahWeight', label: 'Morrah Weight (kg)', type: 'number', unit: 'kg', precision: 3, required: true },
    ],
    calculate: (formData, rows) => {
      const vals = rows.map(r => Number(r.morrahWeight) || 0).filter(v => v > 0);
      const avg = calcMean(vals);
      const { min, max, range } = calcRange(vals);
      const cv = calcCV(vals);
      const target = Number(formData.nominalWeightKg) || 1.80;
      const maxCv = Number(formData.maxCvPct) || 8.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (vals.length < 5) result = 'WARNING';
      else if (cv > maxCv * 1.25 || Math.abs(avg - target) > target * 0.2) result = 'FAIL';
      else if (cv > maxCv || Math.abs(avg - target) > target * 0.1) result = 'WARNING';

      return {
        metrics: {
          sampleCount: vals.length,
          avgWeightKg: Number(avg.toFixed(3)),
          minWeightKg: Number(min.toFixed(3)),
          maxWeightKg: Number(max.toFixed(3)),
          rangeKg: Number(range.toFixed(3)),
          cvPercent: Number(cv.toFixed(2)),
          targetWeightKg: target,
        },
        result,
      };
    },
  },

  'FORM-02': {
    code: 'FORM-02',
    number: 2,
    title: 'Selection – Raw Jute Bundle Strength',
    department: 'Selection',
    departmentCode: 'SEL',
    section: 'Raw Jute Testing',
    sampleUnit: 'g/tex',
    defaultRowCount: 10,
    description: 'Tenacity checking of raw jute fiber bundles using fiber bundle tester.',
    sourceStandardText: 'Standard Bundle Strength (Tenacity): Min 22.0 g/tex. Standard C.V.%: Max 10.0%.',
    fields: [
      { key: 'baleNo', label: 'Bale / Lot No.', type: 'text', required: true },
      { key: 'juteVariety', label: 'Jute Variety (TD / W-4 etc.)', type: 'text', required: true },
      { key: 'standardTenacity', label: 'Standard Tenacity (g/tex)', type: 'number', defaultValue: 24.0, unit: 'g/tex' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'bundleWeightMg', label: 'Bundle Wt (mg)', type: 'number', unit: 'mg' },
      { key: 'breakingLoadKg', label: 'Breaking Load (kg)', type: 'number', unit: 'kg' },
      { key: 'tenacityGtex', label: 'Tenacity (g/tex)', type: 'number', unit: 'g/tex', precision: 2 },
    ],
    calculate: (formData, rows) => {
      const tenacities = rows.map(r => {
        if (r.tenacityGtex) return Number(r.tenacityGtex);
        const w = Number(r.bundleWeightMg);
        const l = Number(r.breakingLoadKg);
        if (w > 0 && l > 0) return (l * 1000) / (w / 5); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avg = calcMean(tenacities);
      const cv = calcCV(tenacities);
      const std = Number(formData.standardTenacity) || 22.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (tenacities.length === 0) result = 'WARNING';
      else if (avg < std * 0.9) result = 'FAIL';
      else if (avg < std) result = 'WARNING';

      return {
        metrics: {
          samples: tenacities.length,
          avgTenacity: Number(avg.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardTenacity: std,
        },
        result,
      };
    },
  },

  'FORM-03': {
    code: 'FORM-03',
    number: 3,
    title: 'Jute Spreader – Sliver Weight Checking',
    department: 'Jute Spreader / Softener',
    departmentCode: 'JSP',
    section: 'Spreader Delivery',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 10,
    hasMoistureCorrection: true,
    description: 'Sliver weight checking per 100 yds with moisture regain correction (Converted Weight = Observed Wt × (100 + Std MR)/(100 + Obs MR)).',
    sourceStandardText: 'Standard Spreader Sliver Weight: Nominal ± 3%. Standard Moisture Regain: 28% to 32%. Max C.V.%: 4.5%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard %MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed %MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight (lbs)', type: 'number', unit: 'lbs', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      const convertedWeights = obsWeights.map(w => moistureCorrect(w, obsMR, stdMR));
      const avgConverted = calcMean(convertedWeights);
      const cv = calcCV(convertedWeights);

      const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0;
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING';

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgObservedLbs: Number(avgObs.toFixed(2)),
          avgConvertedLbs: Number(avgConverted.toFixed(2)),
          percentDeviation: Number(pctDev.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },

  'FORM-04': {
    code: 'FORM-04',
    number: 4,
    title: 'Jute Spreader – Morrah Feeding Rate & Doffing Loss Time Checking',
    department: 'Jute Spreader / Softener',
    departmentCode: 'JSP',
    section: 'Spreader Operation',
    sampleUnit: 'morrah/min',
    defaultRowCount: 5,
    description: 'Calculates: Morrah Feed / Min = Total No. of Morrah Feed ÷ Roll Building Time (minutes). Checks Doffing Loss Time against standard.',
    sourceStandardText: 'Standard Morrah Feeding Rate: 36–42 Morrahs/min. Doffing Loss Time: ≤ 25 seconds.',
    fields: [
      { key: 'targetFeedPerMin', label: 'Standard Feeding Rate (Morrah/min)', type: 'number', defaultValue: 38, unit: 'm/min' },
      { key: 'maxDoffingSec', label: 'Max Doffing Time (sec)', type: 'number', defaultValue: 25, unit: 'sec' },
    ],
    columns: [
      { key: 'rollNo', label: 'Roll No.', type: 'readonly', width: '80px' },
      { key: 'totalMorrahFeed', label: 'Total Morrahs Fed', type: 'number', required: true },
      { key: 'rollBuildingTimeMin', label: 'Roll Building Time (min)', type: 'number', precision: 2, required: true },
      { key: 'doffingLossTimeSec', label: 'Doffing Loss Time (sec)', type: 'number', required: true },
    ],
    calculate: (formData, rows) => {
      let totalMorrahs = 0;
      let totalTime = 0;
      const doffTimes: number[] = [];

      rows.forEach(r => {
        const m = Number(r.totalMorrahFeed) || 0;
        const t = Number(r.rollBuildingTimeMin) || 0;
        const d = Number(r.doffingLossTimeSec) || 0;
        if (m > 0 && t > 0) {
          totalMorrahs += m;
          totalTime += t;
        }
        if (d > 0) doffTimes.push(d);
      });

      const overallFeedRate = totalTime > 0 ? totalMorrahs / totalTime : 0;
      const avgDoffSec = calcMean(doffTimes);
      const targetFeed = Number(formData.targetFeedPerMin) || 38;
      const maxDoff = Number(formData.maxDoffingSec) || 25;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (totalTime === 0) result = 'WARNING';
      else if (Math.abs(overallFeedRate - targetFeed) > 8 || avgDoffSec > maxDoff * 1.3) result = 'FAIL';
      else if (Math.abs(overallFeedRate - targetFeed) > 4 || avgDoffSec > maxDoff) result = 'WARNING';

      return {
        metrics: {
          totalMorrahsFed: totalMorrahs,
          totalBuildingTimeMin: Number(totalTime.toFixed(2)),
          calculatedMorrahFeedPerMin: Number(overallFeedRate.toFixed(2)),
          avgDoffingLossSec: Number(avgDoffSec.toFixed(1)),
          targetFeedPerMin: targetFeed,
        },
        result,
      };
    },
  },

  'FORM-05': {
    code: 'FORM-05',
    number: 5,
    title: 'Jute Spreader / Softener – Emulsion Checking',
    department: 'Jute Spreader / Softener',
    departmentCode: 'JSP',
    section: 'Emulsion Plant',
    sampleUnit: '% Application',
    defaultRowCount: 6,
    description: 'Checks Oil-in-Water emulsion strength, specific gravity, flow rate, and application percentage.',
    sourceStandardText: 'Standard Emulsion Application: 22% to 26% on fiber. Oil content in emulsion: 18% to 22%.',
    fields: [
      { key: 'emulsionTankNo', label: 'Emulsion Tank No.', type: 'text' },
      { key: 'standardEmulsionPct', label: 'Standard Emulsion Application (%)', type: 'number', defaultValue: 24.0, unit: '%' },
      { key: 'standardOilPctInEmulsion', label: 'Standard Oil in Emulsion (%)', type: 'number', defaultValue: 20.0, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample / Nozzle', type: 'readonly', width: '120px' },
      { key: 'oilPct', label: 'Oil % in Emulsion', type: 'number', unit: '%' },
      { key: 'flowRateLpm', label: 'Flow Rate (L/min)', type: 'number', unit: 'L/min', precision: 2 },
      { key: 'applicationPct', label: 'Calculated Application (%)', type: 'number', unit: '%' },
    ],
    calculate: (formData, rows) => {
      const apps = rows.map(r => Number(r.applicationPct) || 0).filter(v => v > 0);
      const oils = rows.map(r => Number(r.oilPct) || 0).filter(v => v > 0);
      const avgApp = calcMean(apps);
      const avgOil = calcMean(oils);
      const stdApp = Number(formData.standardEmulsionPct) || 24.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (apps.length === 0) result = 'WARNING';
      else if (Math.abs(avgApp - stdApp) > 3.5) result = 'FAIL';
      else if (Math.abs(avgApp - stdApp) > 2.0) result = 'WARNING';

      return {
        metrics: {
          avgApplicationPct: Number(avgApp.toFixed(2)),
          avgOilInEmulsionPct: Number(avgOil.toFixed(2)),
          targetApplicationPct: stdApp,
        },
        result,
      };
    },
  },

  'FORM-06': {
    code: 'FORM-06',
    number: 6,
    title: 'Breaker Card – Sliver Weight Checking',
    department: 'Carding',
    departmentCode: 'CRD',
    section: 'Breaker Card',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 10,
    hasMoistureCorrection: true,
    description: 'Breaker card sliver weight checking with moisture regain conversion and C.V.%.',
    sourceStandardText: 'Standard Breaker Card Sliver Wt: Nominal ± 3.5%. Standard MR: 27%. Max C.V.%: 5.0%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 18.5, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard %MR', type: 'number', defaultValue: 27.0, unit: '%' },
      { key: 'observedMR', label: 'Observed %MR', type: 'number', defaultValue: 26.8, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight (lbs)', type: 'number', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 27.0;
      const obsMR = Number(formData.observedMR) || 27.0;
      const stdWt = Number(formData.standardSliverWeight) || 18.5;
      const weights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);
      const converted = weights.map(w => moistureCorrect(w, obsMR, stdMR));
      const avgConverted = calcMean(converted);
      const cv = calcCV(converted);
      const dev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 5.5 || cv > 6.5) result = 'FAIL';
      else if (Math.abs(dev) > 3.5 || cv > 5.0) result = 'WARNING';

      return {
        metrics: {
          avgObserved: Number(calcMean(weights).toFixed(2)),
          avgConverted: Number(avgConverted.toFixed(2)),
          deviationPct: Number(dev.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },

  'FORM-07': {
    code: 'FORM-07',
    number: 7,
    title: 'Inter Card – Sliver Weight Checking',
    department: 'Carding',
    departmentCode: 'CRD',
    section: 'Inter Card',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 10,
    hasMoistureCorrection: true,
    description: 'Inter card sliver weight checking with moisture regain conversion and C.V.%.',
    sourceStandardText: 'Standard Inter Card Sliver Wt: Nominal ± 3.0%. Standard MR: 25%. Max C.V.%: 4.5%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 14.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard %MR', type: 'number', defaultValue: 25.0, unit: '%' },
      { key: 'observedMR', label: 'Observed %MR', type: 'number', defaultValue: 25.0, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight (lbs)', type: 'number', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 25.0;
      const obsMR = Number(formData.observedMR) || 25.0;
      const stdWt = Number(formData.standardSliverWeight) || 14.0;
      const weights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);
      const converted = weights.map(w => moistureCorrect(w, obsMR, stdMR));
      const avgConverted = calcMean(converted);
      const cv = calcCV(converted);
      const dev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 5.0 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(dev) > 3.0 || cv > 4.5) result = 'WARNING';

      return {
        metrics: {
          avgObserved: Number(calcMean(weights).toFixed(2)),
          avgConverted: Number(avgConverted.toFixed(2)),
          deviationPct: Number(dev.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },

  'FORM-08': {
    code: 'FORM-08',
    number: 8,
    title: 'Finisher Card – Sliver Weight Checking',
    department: 'Carding',
    departmentCode: 'CRD',
    section: 'Finisher Card',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 10,
    hasMoistureCorrection: true,
    description: 'Finisher card sliver weight checking with moisture regain conversion and C.V.%.',
    sourceStandardText: 'Standard Finisher Card Sliver Wt: Nominal ± 3.0%. Standard MR: 24%. Max C.V.%: 4.0%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 11.5, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard %MR', type: 'number', defaultValue: 24.0, unit: '%' },
      { key: 'observedMR', label: 'Observed %MR', type: 'number', defaultValue: 24.0, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight (lbs)', type: 'number', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 24.0;
      const obsMR = Number(formData.observedMR) || 24.0;
      const stdWt = Number(formData.standardSliverWeight) || 11.5;
      const weights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);
      const converted = weights.map(w => moistureCorrect(w, obsMR, stdMR));
      const avgConverted = calcMean(converted);
      const cv = calcCV(converted);
      const dev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 4.5 || cv > 5.0) result = 'FAIL';
      else if (Math.abs(dev) > 3.0 || cv > 4.0) result = 'WARNING';

      return {
        metrics: {
          avgObserved: Number(calcMean(weights).toFixed(2)),
          avgConverted: Number(avgConverted.toFixed(2)),
          deviationPct: Number(dev.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },

  'FORM-09': {
    code: 'FORM-09',
    number: 9,
    title: 'Finisher Drawing – Sliver Weight Checking',
    department: 'Drawing',
    departmentCode: 'DRW',
    section: 'Finisher Drawing',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 10,
    hasMoistureCorrection: true,
    description: 'Finisher drawing sliver weight checking before spinning frames.',
    sourceStandardText: 'Standard Finisher Drawing Sliver Wt: Nominal ± 2.5%. Standard MR: 22%. Max C.V.%: 3.5%.',
    fields: [
      { key: 'drawingPass', label: 'Drawing Passage (1st / 2nd / 3rd)', type: 'select', options: ['1st Drawing', '2nd Drawing', '3rd / Finisher Drawing'], defaultValue: '3rd / Finisher Drawing' },
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 3.5, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard %MR', type: 'number', defaultValue: 22.0, unit: '%' },
      { key: 'observedMR', label: 'Observed %MR', type: 'number', defaultValue: 21.8, unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight (lbs)', type: 'number', precision: 3, required: true },
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 22.0;
      const obsMR = Number(formData.observedMR) || 22.0;
      const stdWt = Number(formData.standardSliverWeight) || 3.5;
      const weights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);
      const converted = weights.map(w => moistureCorrect(w, obsMR, stdMR));
      const avgConverted = calcMean(converted);
      const cv = calcCV(converted);
      const dev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 4.0 || cv > 4.5) result = 'FAIL';
      else if (Math.abs(dev) > 2.5 || cv > 3.5) result = 'WARNING';

      return {
        metrics: {
          avgObserved: Number(calcMean(weights).toFixed(3)),
          avgConverted: Number(avgConverted.toFixed(3)),
          deviationPct: Number(dev.toFixed(2)),
          cvPercent: Number(cv.toFixed(2)),
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },

  'FORM-10': {
    code: 'FORM-10',
    number: 10,
    title: 'Spinning – Yarn Count Checking',
    department: 'Spinning',
    departmentCode: 'SPN',
    section: 'Spinning Frames',
    sampleUnit: 'lbs / Spy (Count)',
    defaultRowCount: 10,
    description: 'Yarn Count Checking. Evaluates actual count vs nominal count. Standard rule: Count must be within ±5% of nominal count.',
    sourceStandardText: 'Source Rule: Standard count must be strictly within ±5% of nominal count (lbs/spyndle).',
    fields: [
      { key: 'frameNo', label: 'Frame No.', type: 'text', required: true },
      { key: 'side', label: 'Frame Side (R/S or L/S)', type: 'select', options: ['Right Side (R/S)', 'Left Side (L/S)', 'Both'], defaultValue: 'Right Side (R/S)' },
      { key: 'nominalCountLbs', label: 'Nominal Yarn Count (lbs/spyndle)', type: 'number', defaultValue: 8.0, unit: 'lbs', required: true },
      { key: 'yarnType', label: 'Yarn Type (Warp / Weft)', type: 'select', options: ['Warp (Hessian)', 'Weft (Hessian)', 'Warp (Sacking)', 'Weft (Sacking)'], defaultValue: 'Warp (Hessian)' },
    ],
    columns: [
      { key: 'spindleNo', label: 'Spindle / Bobbin No.', type: 'text', width: '120px' },
      { key: 'observedCountLbs', label: 'Observed Count (lbs/spy)', type: 'number', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      const nominal = Number(formData.nominalCountLbs) || 8.0;
      const counts = rows.map(r => Number(r.observedCountLbs) || 0).filter(v => v > 0);
      const avg = calcMean(counts);
      const cv = calcCV(counts);
      const pctDev = nominal > 0 ? ((avg - nominal) / nominal) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (counts.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5.0) result = 'FAIL'; // Source rule: ±5%
      else if (Math.abs(pctDev) > 3.0 || cv > 7.0) result = 'WARNING';

      return {
        metrics: {
          sampleCount: counts.length,
          nominalCount: nominal,
          averageCount: Number(avg.toFixed(2)),
          countDeviationPct: Number(pctDev.toFixed(2)),
          countCVPercent: Number(cv.toFixed(2)),
        },
        result,
      };
    },
  },

  'FORM-11': {
    code: 'FORM-11',
    number: 11,
    title: 'Spinning – Yarn Parameter Checking',
    department: 'Spinning',
    departmentCode: 'SPN',
    section: 'Yarn Testing Lab / Spinning',
    sampleUnit: 'lbs, TPI, %QR',
    defaultRowCount: 10,
    description: 'Calculates Weight C.V.%, Strength C.V.%, Average %QR, Minimum %QR, and TPI C.V.% against quality standards.',
    sourceStandardText: 'Standard Quality Ratio (%QR): Min 90% (Hessian Warp), Min 85% (Weft). Weight CV: Max 6.0%. Strength CV: Max 12%. TPI CV: Max 8%.',
    fields: [
      { key: 'yarnQuality', label: 'Yarn Quality / Count', type: 'text', defaultValue: '8.0 lbs Hessian Warp' },
      { key: 'minQualityRatioPct', label: 'Standard Min %QR', type: 'number', defaultValue: 90, unit: '%' },
      { key: 'targetTPI', label: 'Target TPI (Twist/Inch)', type: 'number', defaultValue: 4.5 },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '80px' },
      { key: 'weightLbs', label: 'Skein Wt (lbs/spy)', type: 'number', precision: 2, required: true },
      { key: 'breakingStrengthLbs', label: 'Breaking Str (lbs)', type: 'number', precision: 2, required: true },
      { key: 'tpi', label: 'TPI (Twist/Inch)', type: 'number', precision: 1 },
    ],
    calculate: (formData, rows) => {
      const weights: number[] = [];
      const strengths: number[] = [];
      const tpis: number[] = [];
      const qrs: number[] = [];

      rows.forEach(r => {
        const w = Number(r.weightLbs) || 0;
        const s = Number(r.breakingStrengthLbs) || 0;
        const t = Number(r.tpi) || 0;
        if (w > 0) weights.push(w);
        if (s > 0) strengths.push(s);
        if (t > 0) tpis.push(t);
        if (w > 0 && s > 0) {
          qrs.push((s / w) * 100); // % Quality Ratio = (Breaking Strength ÷ Count) * 100
        }
      });

      const avgWeight = calcMean(weights);
      const wtCV = calcCV(weights);
      const avgStr = calcMean(strengths);
      const strCV = calcCV(strengths);
      const avgTPI = calcMean(tpis);
      const tpiCV = calcCV(tpis);
      const avgQR = calcMean(qrs);
      const minQR = qrs.length > 0 ? Math.min(...qrs) : 0;
      const stdMinQR = Number(formData.minQualityRatioPct) || 90;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (avgQR < stdMinQR || minQR < stdMinQR * 0.8 || wtCV > 8.0) result = 'FAIL';
      else if (avgQR < stdMinQR + 3 || wtCV > 6.0 || strCV > 14.0) result = 'WARNING';

      return {
        metrics: {
          samples: weights.length,
          avgWeight: Number(avgWeight.toFixed(2)),
          weightCV: Number(wtCV.toFixed(2)),
          avgStrength: Number(avgStr.toFixed(2)),
          strengthCV: Number(strCV.toFixed(2)),
          avgQR: Number(avgQR.toFixed(1)),
          minQR: Number(minQR.toFixed(1)),
          avgTPI: Number(avgTPI.toFixed(2)),
          tpiCV: Number(tpiCV.toFixed(2)),
        },
        result,
      };
    },
  },

  'FORM-12': {
    code: 'FORM-12',
    number: 12,
    title: 'Winding – Cop Dimension & Defects Checking',
    department: 'Winding',
    departmentCode: 'WND',
    section: 'Cop Winding',
    sampleUnit: 'Inches / Defect Count',
    defaultRowCount: 10,
    description: 'Checks cop length, diameter and defects (soft cop, sloughing off, bad shape) against quality standards.',
    sourceStandardText: 'Standard Cop Length: 10.0" ± 0.25". Standard Diameter: 1.50" to 1.625". Defective Cops: Max 3%.',
    fields: [
      { key: 'standardLengthInch', label: 'Standard Length (inch)', type: 'number', defaultValue: 10.0, unit: 'in' },
      { key: 'standardDiameterInch', label: 'Standard Diameter (inch)', type: 'number', defaultValue: 1.56, unit: 'in' },
      { key: 'spindleSpeedRpm', label: 'Spindle Speed (RPM)', type: 'number', defaultValue: 2800 },
    ],
    columns: [
      { key: 'spindleNo', label: 'Spindle No.', type: 'text', width: '100px' },
      { key: 'lengthInch', label: 'Length (in)', type: 'number', precision: 2 },
      { key: 'diameterInch', label: 'Diameter (in)', type: 'number', precision: 2 },
      { key: 'defectType', label: 'Defect (if any)', type: 'select', options: ['None', 'Soft Cop', 'Hard Cop', 'Slough-off', 'Bad Shape', 'Damaged Base'] },
    ],
    calculate: (formData, rows) => {
      const lengths = rows.map(r => Number(r.lengthInch) || 0).filter(v => v > 0);
      const diameters = rows.map(r => Number(r.diameterInch) || 0).filter(v => v > 0);
      const defectiveCount = rows.filter(r => r.defectType && r.defectType !== 'None').length;

      const avgL = calcMean(lengths);
      const avgD = calcMean(diameters);
      const defectPct = rows.length > 0 ? (defectiveCount / rows.length) * 100 : 0;
      const stdL = Number(formData.standardLengthInch) || 10.0;
      const stdD = Number(formData.standardDiameterInch) || 1.56;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (rows.length === 0) result = 'WARNING';
      else if (Math.abs(avgL - stdL) > 0.5 || defectPct > 5.0) result = 'FAIL';
      else if (Math.abs(avgL - stdL) > 0.25 || Math.abs(avgD - stdD) > 0.1 || defectPct > 2.0) result = 'WARNING';

      return {
        metrics: {
          totalChecked: rows.length,
          avgLengthInch: Number(avgL.toFixed(2)),
          avgDiameterInch: Number(avgD.toFixed(2)),
          defectiveCops: defectiveCount,
          defectPercentage: Number(defectPct.toFixed(1)),
        },
        result,
      };
    },
  },

  'FORM-13': {
    code: 'FORM-13',
    number: 13,
    title: 'Beaming – No. of Ends Checking at Beaming',
    department: 'Beaming',
    departmentCode: 'BMG',
    section: 'Beaming Machine',
    sampleUnit: 'Ends',
    defaultRowCount: 4,
    description: 'Calculates standard number of ends: Standard Ends = (Fabric Width in inches × Ends Per Inch) + Selvedge Ends.',
    sourceStandardText: 'Calculated Formula: Total Standard Ends = (Width inch × Ends/Inch) + Selvedge Ends. Permissible deviation: 0 missing ends.',
    fields: [
      { key: 'beamNo', label: 'Beam No.', type: 'text', required: true },
      { key: 'fabricWidthInch', label: 'Fabric Width (inch)', type: 'number', defaultValue: 40.0, unit: 'in', required: true },
      { key: 'endsPerInch', label: 'Ends Per Inch (EPI / Porter)', type: 'number', defaultValue: 11.0, required: true },
      { key: 'selvedgeEnds', label: 'Selvedge Ends', type: 'number', defaultValue: 24 },
      { key: 'actualObservedEnds', label: 'Actual Counted Ends', type: 'number', required: true },
    ],
    columns: [
      { key: 'sectionNo', label: 'Creel / Section No.', type: 'text' },
      { key: 'spoolCount', label: 'Spools Running', type: 'number' },
      { key: 'missingEnds', label: 'Missing / Cross Ends', type: 'number' },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ],
    calculate: (formData, rows) => {
      const width = Number(formData.fabricWidthInch) || 40;
      const epi = Number(formData.endsPerInch) || 11;
      const selvedge = Number(formData.selvedgeEnds) || 24;
      const stdEnds = Math.round(width * epi + selvedge);
      const actualEnds = Number(formData.actualObservedEnds) || stdEnds;
      const totalMissing = rows.reduce((s, r) => s + (Number(r.missingEnds) || 0), 0);
      const diff = actualEnds - stdEnds;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (Math.abs(diff) > 4 || totalMissing > 4) result = 'FAIL';
      else if (Math.abs(diff) > 0 || totalMissing > 0) result = 'WARNING';

      return {
        metrics: {
          standardCalculatedEnds: stdEnds,
          actualCountedEnds: actualEnds,
          differenceEnds: diff,
          totalMissingEndsReported: totalMissing,
        },
        result,
      };
    },
  },

  'FORM-14': {
    code: 'FORM-14',
    number: 14,
    title: 'Beaming – %MR Checking at Beam',
    department: 'Beaming',
    departmentCode: 'BMG',
    section: 'Beamed Rolls',
    sampleUnit: '% Moisture Regain',
    defaultRowCount: 8,
    description: 'Evaluates observed beam %MR against quality-specific ranges: Broad Loom/STB (18–22%), Hessian (16–18%), Sacking (18–20%).',
    sourceStandardText: 'Standard Moisture Regain at Beaming: Broad Loom / STB: 18.0–22.0%; Hessian: 16.0–18.0%; Sacking: 18.0–20.0%.',
    fields: [
      { key: 'fabricType', label: 'Fabric Quality Group', type: 'select', options: ['Broad Loom / STB (18–22%)', 'Hessian (16–18%)', 'Sacking (18–20%)'], defaultValue: 'Hessian (16–18%)' },
      { key: 'minMR', label: 'Min Standard %MR', type: 'number', defaultValue: 16.0, unit: '%' },
      { key: 'maxMR', label: 'Max Standard %MR', type: 'number', defaultValue: 18.0, unit: '%' },
    ],
    columns: [
      { key: 'beamNo', label: 'Beam No.', type: 'text', width: '100px' },
      { key: 'sideReading', label: 'Side / Flange %MR', type: 'number', precision: 1 },
      { key: 'middleReading', label: 'Middle %MR', type: 'number', precision: 1 },
      { key: 'averageMR', label: 'Average %MR', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const mrs = rows.map(r => Number(r.averageMR) || 0).filter(v => v > 0);
      const avg = calcMean(mrs);
      const minStd = Number(formData.minMR) || 16.0;
      const maxStd = Number(formData.maxMR) || 18.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (mrs.length === 0) result = 'WARNING';
      else if (avg < minStd - 1.5 || avg > maxStd + 1.5) result = 'FAIL';
      else if (avg < minStd || avg > maxStd) result = 'WARNING';

      return {
        metrics: {
          samples: mrs.length,
          avgBeamMR: Number(avg.toFixed(1)),
          minStdMR: minStd,
          maxStdMR: maxStd,
        },
        result,
      };
    },
  },

  'FORM-15': {
    code: 'FORM-15',
    number: 15,
    title: 'Weaving – Width & Picks Checking at Loom',
    department: 'Weaving',
    departmentCode: 'WVG',
    section: 'Loom Shed',
    sampleUnit: 'inch / picks per dm',
    defaultRowCount: 10,
    description: 'On-loom checking of reed space, fabric on-loom width, and picks per decimetre.',
    sourceStandardText: 'Width standard: Nominal +0.5" / -0.0". Picks standard: Nominal ± 1 pick/dm.',
    fields: [
      { key: 'shedNo', label: 'Shed No.', type: 'text', defaultValue: 'Shed-1' },
      { key: 'standardWidthInch', label: 'Nominal Width (inch)', type: 'number', defaultValue: 40.0, unit: 'in' },
      { key: 'standardPicksPerDm', label: 'Nominal Picks (per dm)', type: 'number', defaultValue: 47.0 },
    ],
    columns: [
      { key: 'loomNo', label: 'Loom No.', type: 'text', width: '90px', required: true },
      { key: 'observedWidthInch', label: 'Observed Width (in)', type: 'number', precision: 2, required: true },
      { key: 'observedPicksDm', label: 'Observed Picks/dm', type: 'number', precision: 1, required: true },
      { key: 'weaverName', label: 'Weaver Name', type: 'text' },
    ],
    calculate: (formData, rows) => {
      const widths = rows.map(r => Number(r.observedWidthInch) || 0).filter(v => v > 0);
      const picks = rows.map(r => Number(r.observedPicksDm) || 0).filter(v => v > 0);
      const stdW = Number(formData.standardWidthInch) || 40.0;
      const stdP = Number(formData.standardPicksPerDm) || 47.0;

      const avgW = calcMean(widths);
      const avgP = calcMean(picks);

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (widths.length === 0) result = 'WARNING';
      else if (avgW < stdW || Math.abs(avgP - stdP) > 2.0) result = 'FAIL';
      else if (avgW > stdW + 1.0 || Math.abs(avgP - stdP) > 1.0) result = 'WARNING';

      return {
        metrics: {
          checkedLooms: widths.length,
          avgWidthInch: Number(avgW.toFixed(2)),
          avgPicksPerDm: Number(avgP.toFixed(1)),
          stdWidth: stdW,
          stdPicks: stdP,
        },
        result,
      };
    },
  },

  'FORM-16': {
    code: 'FORM-16',
    number: 16,
    title: 'Weaving – Fabric Texture Checking on Loom',
    department: 'Weaving',
    departmentCode: 'WVG',
    section: 'Loom Shed Inspection',
    sampleUnit: 'Loom Defect %',
    defaultRowCount: 10,
    description: 'Calculates Grand Total Defective Looms and % Defective Looms = Total Defective Looms ÷ No. of Looms Running × 100.',
    sourceStandardText: 'Formula: % Defective Looms = (Total Defective Looms ÷ No. of Looms Running) × 100. Standard: ≤ 3.0%.',
    fields: [
      { key: 'totalLoomsRunning', label: 'No. of Looms Running in Shift', type: 'number', defaultValue: 120, required: true },
      { key: 'maxDefectivePct', label: 'Max Permissible Defective %', type: 'number', defaultValue: 3.0, unit: '%' },
    ],
    columns: [
      { key: 'loomNo', label: 'Loom No.', type: 'text', width: '90px', required: true },
      { key: 'faultType', label: 'Observed Fault', type: 'select', options: ['None', 'Reed Mark', 'Broken Warp', 'Wrong Draw', 'Temple Mark', 'Slack Selvedge', 'Bad Beat-up', 'Smash'] },
      { key: 'actionTaken', label: 'Action Taken', type: 'text' },
    ],
    calculate: (formData, rows) => {
      const running = Number(formData.totalLoomsRunning) || 120;
      const defectiveLooms = rows.filter(r => r.faultType && r.faultType !== 'None').length;
      const pctDefective = running > 0 ? (defectiveLooms / running) * 100 : 0;
      const maxPct = Number(formData.maxDefectivePct) || 3.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (pctDefective > maxPct * 1.5) result = 'FAIL';
      else if (pctDefective > maxPct) result = 'WARNING';

      return {
        metrics: {
          runningLooms: running,
          grandTotalDefectiveLooms: defectiveLooms,
          percentDefectiveLooms: Number(pctDefective.toFixed(2)),
          standardMaxPercent: maxPct,
        },
        result,
      };
    },
  },

  'FORM-17': {
    code: 'FORM-17',
    number: 17,
    title: 'Calender – Cloth Checking Report',
    department: 'Calender',
    departmentCode: 'CAL',
    section: 'Calender Section',
    sampleUnit: 'yds / inch / %MR',
    defaultRowCount: 8,
    description: 'Checks post-calender cloth width, feel, moisture regain, and roller marks.',
    sourceStandardText: 'Calendered Width: Nominal ± 0.25". %MR: 14%–16%. Finish: Uniform, free of roller cuts.',
    fields: [
      { key: 'machineNo', label: 'Calender Machine No.', type: 'text', defaultValue: 'Calender-1' },
      { key: 'standardWidthInch', label: 'Nominal Width (in)', type: 'number', defaultValue: 40.0 },
      { key: 'targetMR', label: 'Target %MR', type: 'number', defaultValue: 15.0 },
    ],
    columns: [
      { key: 'rollNo', label: 'Roll / Cut No.', type: 'text', width: '100px' },
      { key: 'measuredWidth', label: 'Width (in)', type: 'number', precision: 2 },
      { key: 'measuredMR', label: '%MR', type: 'number', precision: 1 },
      { key: 'finishDefects', label: 'Defects / Marks', type: 'text' },
    ],
    calculate: (formData, rows) => {
      const widths = rows.map(r => Number(r.measuredWidth) || 0).filter(v => v > 0);
      const mrs = rows.map(r => Number(r.measuredMR) || 0).filter(v => v > 0);
      const avgW = calcMean(widths);
      const avgMR = calcMean(mrs);
      const stdW = Number(formData.standardWidthInch) || 40.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (widths.length === 0) result = 'WARNING';
      else if (Math.abs(avgW - stdW) > 0.5 || avgMR > 17.5 || avgMR < 13.0) result = 'FAIL';
      else if (Math.abs(avgW - stdW) > 0.25 || avgMR > 16.5 || avgMR < 14.0) result = 'WARNING';

      return {
        metrics: {
          rollsInspected: widths.length,
          avgWidthInch: Number(avgW.toFixed(2)),
          avgMoistureRegain: Number(avgMR.toFixed(1)),
        },
        result,
      };
    },
  },

  'FORM-18': {
    code: 'FORM-18',
    number: 18,
    title: 'Lapping – Floor Inspection Report for Finished Cloth',
    department: 'Lapping',
    departmentCode: 'LAP',
    section: 'Finished Cloth Inspection Floor',
    sampleUnit: 'Various (Length, Width, Picks, Ends, HY/LT)',
    defaultRowCount: 5,
    description: 'Finished cloth comprehensive inspection for Cut Length, Finished Width, Picks, Ends, and Hundred Yards Weight (HY/LT).',
    sourceStandardText: 'Standard: Width +0.5"/-0.0". Ends & Picks: As per spec. HY/LT: Nominal ± 3.0%.',
    fields: [
      { key: 'qualitySpecification', label: 'Specification Name', type: 'text', defaultValue: '40"-10oz/40" Hessian' },
      { key: 'nominalHYLT', label: 'Nominal HY/LT (lbs/100 yds)', type: 'number', defaultValue: 25.0, unit: 'lbs' },
      { key: 'nominalWidthInch', label: 'Nominal Width (inch)', type: 'number', defaultValue: 40.0, unit: 'in' },
    ],
    columns: [
      { key: 'pieceNo', label: 'Piece No.', type: 'text', width: '90px' },
      { key: 'lengthYds', label: 'Length (yds)', type: 'number', precision: 1 },
      { key: 'widthInch', label: 'Width (in)', type: 'number', precision: 2 },
      { key: 'ends', label: 'Total Ends', type: 'number' },
      { key: 'picksDm', label: 'Picks/dm', type: 'number' },
      { key: 'actualHYLT', label: 'HY/LT (lbs)', type: 'number', precision: 2 },
    ],
    calculate: (formData, rows) => {
      const hylts = rows.map(r => Number(r.actualHYLT) || 0).filter(v => v > 0);
      const widths = rows.map(r => Number(r.widthInch) || 0).filter(v => v > 0);
      const avgHY = calcMean(hylts);
      const avgW = calcMean(widths);
      const nomHY = Number(formData.nominalHYLT) || 25.0;
      const devHY = nomHY > 0 ? ((avgHY - nomHY) / nomHY) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (hylts.length === 0) result = 'WARNING';
      else if (Math.abs(devHY) > 4.5) result = 'FAIL';
      else if (Math.abs(devHY) > 3.0) result = 'WARNING';

      return {
        metrics: {
          piecesChecked: hylts.length,
          avgHYLT: Number(avgHY.toFixed(2)),
          hyltDeviationPct: Number(devHY.toFixed(2)),
          avgWidthInch: Number(avgW.toFixed(2)),
        },
        result,
      };
    },
  },

  'FORM-19': {
    code: 'FORM-19',
    number: 19,
    title: 'Lapping – %MR Checking for Finished Cloth',
    department: 'Lapping',
    departmentCode: 'LAP',
    section: 'Finished Cloth Inspection',
    sampleUnit: '% Moisture Regain',
    defaultRowCount: 8,
    description: 'Post-finishing moisture regain determination across cloth pieces.',
    sourceStandardText: 'Finished Cloth Standard %MR: 14.0% to 16.0% for Hessian; 16.0% to 18.0% for Sacking.',
    fields: [
      { key: 'minAcceptableMR', label: 'Min Acceptable %MR', type: 'number', defaultValue: 14.0, unit: '%' },
      { key: 'maxAcceptableMR', label: 'Max Acceptable %MR', type: 'number', defaultValue: 16.5, unit: '%' },
    ],
    columns: [
      { key: 'cutPieceNo', label: 'Cut / Piece No.', type: 'text', width: '110px' },
      { key: 'moisturePct', label: 'Measured %MR', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const mrs = rows.map(r => Number(r.moisturePct) || 0).filter(v => v > 0);
      const avg = calcMean(mrs);
      const minStd = Number(formData.minAcceptableMR) || 14.0;
      const maxStd = Number(formData.maxAcceptableMR) || 16.5;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (mrs.length === 0) result = 'WARNING';
      else if (avg < minStd - 1.0 || avg > maxStd + 1.0) result = 'FAIL';
      else if (avg < minStd || avg > maxStd) result = 'WARNING';

      return {
        metrics: {
          sampleCount: mrs.length,
          avgFinishedClothMR: Number(avg.toFixed(1)),
          minAllowedMR: minStd,
          maxAllowedMR: maxStd,
        },
        result,
      };
    },
  },

  'FORM-20': {
    code: 'FORM-20',
    number: 20,
    title: 'Cutting – Cutting Length Checking at Cutting Machine',
    department: 'Cutting',
    departmentCode: 'CUT',
    section: 'Automatic / Manual Cutting Machine',
    sampleUnit: 'cm',
    defaultRowCount: 10,
    description: 'Formula: Standard Cutting Length = (Specified Bag Length × 2) + 10 cm. Compares observed cutting lengths against standard.',
    sourceStandardText: 'Source Formula: Standard Cutting Length = (Specified Bag Length × 2) + 10 cm. Tolerance: ± 1.5 cm.',
    fields: [
      { key: 'specifiedBagLengthCm', label: 'Specified Bag Length (cm)', type: 'number', defaultValue: 94.0, unit: 'cm', required: true },
      { key: 'toleranceCm', label: 'Permissible Tolerance (± cm)', type: 'number', defaultValue: 1.5, unit: 'cm' },
    ],
    columns: [
      { key: 'pieceNo', label: 'Cut Piece No.', type: 'readonly', width: '100px' },
      { key: 'observedCutLengthCm', label: 'Observed Length (cm)', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const bagLen = Number(formData.specifiedBagLengthCm) || 94.0;
      const stdCut = bagLen * 2 + 10.0; // Source formula: (Bag Length × 2) + 10 cm
      const tol = Number(formData.toleranceCm) || 1.5;
      const lens = rows.map(r => Number(r.observedCutLengthCm) || 0).filter(v => v > 0);
      const avg = calcMean(lens);
      const dev = avg - stdCut;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (lens.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > tol * 1.5) result = 'FAIL';
      else if (Math.abs(dev) > tol) result = 'WARNING';

      return {
        metrics: {
          specifiedBagLengthCm: bagLen,
          standardCuttingLengthCm: Number(stdCut.toFixed(1)),
          averageObservedLengthCm: Number(avg.toFixed(1)),
          lengthDeviationCm: Number(dev.toFixed(1)),
          toleranceCm: tol,
        },
        result,
      };
    },
  },

  'FORM-21': {
    code: 'FORM-21',
    number: 21,
    title: 'Godown – Cutting Length Checking at Different Godown',
    department: 'Godown',
    departmentCode: 'GDN',
    section: 'Godown Stored Cut Pieces',
    sampleUnit: 'cm',
    defaultRowCount: 10,
    description: 'Formula: Standard Cutting Length = (Specified Bag Length × 2) + 10 cm. Checks stored cut piece lengths at godown.',
    sourceStandardText: 'Source Formula: Standard Cutting Length = (Specified Bag Length × 2) + 10 cm. Tolerance: ± 2.0 cm.',
    fields: [
      { key: 'godownLocation', label: 'Godown / Shed Location', type: 'text', defaultValue: 'Godown No. 3' },
      { key: 'specifiedBagLengthCm', label: 'Specified Bag Length (cm)', type: 'number', defaultValue: 94.0, unit: 'cm', required: true },
    ],
    columns: [
      { key: 'bundleNo', label: 'Bundle No.', type: 'text', width: '100px' },
      { key: 'observedCutLengthCm', label: 'Observed Length (cm)', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const bagLen = Number(formData.specifiedBagLengthCm) || 94.0;
      const stdCut = bagLen * 2 + 10.0;
      const lens = rows.map(r => Number(r.observedCutLengthCm) || 0).filter(v => v > 0);
      const avg = calcMean(lens);
      const dev = avg - stdCut;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (lens.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 3.0) result = 'FAIL';
      else if (Math.abs(dev) > 2.0) result = 'WARNING';

      return {
        metrics: {
          standardCuttingLengthCm: Number(stdCut.toFixed(1)),
          averageObservedLengthCm: Number(avg.toFixed(1)),
          lengthDeviationCm: Number(dev.toFixed(1)),
        },
        result,
      };
    },
  },

  'FORM-22': {
    code: 'FORM-22',
    number: 22,
    title: 'Godown – Bag Length & Defects Checking',
    department: 'Godown',
    departmentCode: 'GDN',
    section: 'Godown Bag Inspection',
    sampleUnit: 'cm / Defect %',
    defaultRowCount: 10,
    description: 'Source rule: Bag length must be Specified Length +4 cm / -0 cm. Total defects must remain within 4%. Includes stitching and weaving defects.',
    sourceStandardText: 'Source Standard: Length = Specified +4 cm / -0 cm. Max allowable defects: 4.0%.',
    fields: [
      { key: 'specifiedBagLengthCm', label: 'Specified Length (cm)', type: 'number', defaultValue: 94.0, unit: 'cm', required: true },
      { key: 'specifiedBagWidthCm', label: 'Specified Width (cm)', type: 'number', defaultValue: 57.0, unit: 'cm' },
    ],
    columns: [
      { key: 'bagNo', label: 'Bag No.', type: 'readonly', width: '80px' },
      { key: 'measuredLengthCm', label: 'Length (cm)', type: 'number', precision: 1, required: true },
      { key: 'stitchingDefect', label: 'Stitching Defect', type: 'select', options: ['None', 'Open Seam', 'Loose Stitch', 'Irregular Stitch', 'Skipped Stitch'] },
      { key: 'weavingDefect', label: 'Weaving Defect', type: 'select', options: ['None', 'Major Hole', 'Oil Stain', 'Broken Warp', 'Gaw'] },
    ],
    calculate: (formData, rows) => {
      const specL = Number(formData.specifiedBagLengthCm) || 94.0;
      const lens = rows.map(r => Number(r.measuredLengthCm) || 0).filter(v => v > 0);
      const avgL = calcMean(lens);

      let defectCount = 0;
      rows.forEach(r => {
        if ((r.stitchingDefect && r.stitchingDefect !== 'None') || (r.weavingDefect && r.weavingDefect !== 'None')) {
          defectCount++;
        }
      });

      const defectPct = rows.length > 0 ? (defectCount / rows.length) * 100 : 0;
      const lenDiff = avgL - specL;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (lens.length === 0) result = 'WARNING';
      else if (lenDiff < 0 || lenDiff > 5.0 || defectPct > 4.0) result = 'FAIL'; // +4cm / -0cm, max 4% defects
      else if (lenDiff > 4.0 || defectPct > 2.0) result = 'WARNING';

      return {
        metrics: {
          specifiedLengthCm: specL,
          avgLengthCm: Number(avgL.toFixed(1)),
          lengthDifferenceCm: Number(lenDiff.toFixed(1)),
          defectiveBags: defectCount,
          defectPercentage: Number(defectPct.toFixed(1)),
        },
        result,
      };
    },
  },

  'FORM-23': {
    code: 'FORM-23',
    number: 23,
    title: 'Mill / Godown Sacksewing – Stitch Checking After Herackle',
    department: 'Sacksewing',
    departmentCode: 'SSW',
    section: 'Herackle Sewing Machine',
    sampleUnit: 'stitches / dm',
    defaultRowCount: 10,
    description: 'Validates Herackle stitch count against the source standard of 9 to 11 stitches/DM.',
    sourceStandardText: 'Source Standard: 9 to 11 stitches / DM. Uniform tension, no dropped stitches.',
    fields: [
      { key: 'machineNo', label: 'Herackle Machine No.', type: 'text', defaultValue: 'Herackle-04' },
      { key: 'standardMinStitches', label: 'Min Stitches/DM', type: 'number', defaultValue: 9 },
      { key: 'standardMaxStitches', label: 'Max Stitches/DM', type: 'number', defaultValue: 11 },
    ],
    columns: [
      { key: 'bagSampleNo', label: 'Bag Sample No.', type: 'readonly', width: '100px' },
      { key: 'sideStitchesDm', label: 'Side Stitches / DM', type: 'number', precision: 1, required: true },
      { key: 'bottomStitchesDm', label: 'Bottom Stitches / DM', type: 'number', precision: 1 },
      { key: 'stitchTension', label: 'Stitch Tension / Quality', type: 'select', options: ['Good / Uniform', 'Loose', 'Tight / Puckering'] },
    ],
    calculate: (formData, rows) => {
      const stitches = rows.map(r => Number(r.sideStitchesDm) || 0).filter(v => v > 0);
      const avg = calcMean(stitches);
      const minStd = Number(formData.standardMinStitches) || 9;
      const maxStd = Number(formData.standardMaxStitches) || 11;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (stitches.length === 0) result = 'WARNING';
      else if (avg < minStd - 0.5 || avg > maxStd + 0.5) result = 'FAIL';
      else if (avg < minStd || avg > maxStd) result = 'WARNING';

      return {
        metrics: {
          samplesChecked: stitches.length,
          avgStitchesPerDm: Number(avg.toFixed(1)),
          minAllowed: minStd,
          maxAllowed: maxStd,
        },
        result,
      };
    },
  },

  'FORM-24': {
    code: 'FORM-24',
    number: 24,
    title: 'Sacksewing / Bale Point – Finished Bag Checking Report',
    department: 'Sacksewing',
    departmentCode: 'SSW',
    section: 'Bale Point / Final Bag QC',
    sampleUnit: 'Bags & Defect %',
    defaultRowCount: 10,
    description: 'Final inspection of finished sewn bags before baling press: Dimensions, Weight, Stitching, Branding/Marking.',
    sourceStandardText: 'Standard Bag Weight: Nominal ± 3.5%. Stitching: Intact. Print: Clear, correct ink.',
    fields: [
      { key: 'bagType', label: 'Bag Type (A.Twill / B.Twill / D.W. Flour / Coffee etc.)', type: 'text', defaultValue: 'B.Twill 2¼ lbs' },
      { key: 'nominalBagWeightGms', label: 'Nominal Weight (grams)', type: 'number', defaultValue: 1020, unit: 'g' },
    ],
    columns: [
      { key: 'bagNo', label: 'Bag No.', type: 'readonly', width: '80px' },
      { key: 'actualWeightGms', label: 'Weight (g)', type: 'number', required: true },
      { key: 'hemDefect', label: 'Hemming Defect', type: 'select', options: ['None', 'Poor Hem', 'Open Hem'] },
      { key: 'printQuality', label: 'Branding / Print', type: 'select', options: ['Clear', 'Smudged', 'Misaligned', 'Faint'] },
    ],
    calculate: (formData, rows) => {
      const nom = Number(formData.nominalBagWeightGms) || 1020;
      const weights = rows.map(r => Number(r.actualWeightGms) || 0).filter(v => v > 0);
      const avg = calcMean(weights);
      const dev = nom > 0 ? ((avg - nom) / nom) * 100 : 0;
      const defectCount = rows.filter(r => (r.hemDefect && r.hemDefect !== 'None') || (r.printQuality && r.printQuality !== 'Clear')).length;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (weights.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > 4.5 || defectCount > 2) result = 'FAIL';
      else if (Math.abs(dev) > 3.0 || defectCount > 0) result = 'WARNING';

      return {
        metrics: {
          totalBagsInspected: weights.length,
          avgWeightGms: Number(avg.toFixed(1)),
          weightDeviationPct: Number(dev.toFixed(2)),
          defectiveBagsCount: defectCount,
        },
        result,
      };
    },
  },

  'FORM-25': {
    code: 'FORM-25',
    number: 25,
    title: 'Press – HY/LT Calculation of Finished Bale',
    department: 'Press',
    departmentCode: 'PRS',
    section: 'Baling Press',
    sampleUnit: 'kg / Bale',
    defaultRowCount: 5,
    description: 'Calculates standard bale weight for Fabric and Bag according to source formulas.',
    sourceStandardText: 'Formula Fabric Bale: Std Wt = (Total Yards × HY/LT in lbs ÷ 100) × 0.4536 kg + Hoop Tare. Formula Bag Bale: Std Wt = (No. of Bags × Bag Wt in kg) + Hoop Tare.',
    fields: [
      { key: 'baleType', label: 'Bale Content Type', type: 'select', options: ['Bag Bale', 'Cloth / Fabric Bale'], defaultValue: 'Bag Bale' },
      { key: 'itemCount', label: 'Quantity (Bags or Yards in Bale)', type: 'number', defaultValue: 500, required: true },
      { key: 'unitWeight', label: 'Unit Weight (g/bag or HYLT lbs/100 yds)', type: 'number', defaultValue: 1020, required: true },
      { key: 'hoopTareWeightKg', label: 'Hoop Iron & Wrapper Tare (kg)', type: 'number', defaultValue: 4.5, unit: 'kg' },
    ],
    columns: [
      { key: 'baleNo', label: 'Bale No.', type: 'text', width: '100px', required: true },
      { key: 'grossWeightKg', label: 'Gross Wt (kg)', type: 'number', precision: 2, required: true },
      { key: 'netWeightKg', label: 'Net Wt (kg)', type: 'number', precision: 2 },
    ],
    calculate: (formData, rows) => {
      const type = formData.baleType;
      const count = Number(formData.itemCount) || 500;
      const unitW = Number(formData.unitWeight) || 1020;
      const tare = Number(formData.hoopTareWeightKg) || 4.5;

      let stdNetKg = 0;
      if (type === 'Cloth / Fabric Bale') {
        // Yards × HYLT/100 × 0.4536
        stdNetKg = ((count * unitW) / 100) * 0.4536;
      } else {
        // Bags × (g/bag / 1000)
        stdNetKg = (count * unitW) / 1000;
      }
      const stdGrossKg = stdNetKg + tare;

      const grossVals = rows.map(r => Number(r.grossWeightKg) || 0).filter(v => v > 0);
      const avgGross = calcMean(grossVals);
      const devGross = stdGrossKg > 0 ? ((avgGross - stdGrossKg) / stdGrossKg) * 100 : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (grossVals.length === 0) result = 'WARNING';
      else if (Math.abs(devGross) > 3.5) result = 'FAIL';
      else if (Math.abs(devGross) > 2.0) result = 'WARNING';

      return {
        metrics: {
          standardNetKg: Number(stdNetKg.toFixed(2)),
          standardGrossKg: Number(stdGrossKg.toFixed(2)),
          averageActualGrossKg: Number(avgGross.toFixed(2)),
          weightDeviationPct: Number(devGross.toFixed(2)),
        },
        result,
      };
    },
  },

  'FORM-26': {
    code: 'FORM-26',
    number: 26,
    title: 'Press – HY/LT Summary of Finished Bale',
    department: 'Press',
    departmentCode: 'PRS',
    section: 'Press Daily Summary',
    sampleUnit: 'Bales Summary',
    defaultRowCount: 8,
    description: 'Summary compilation of pressed bales for shift/day, verifying average HY/LT compliance across lots.',
    sourceStandardText: 'Permissible Bale Lot Deviation: Max ± 1.5% across pressed lot.',
    fields: [
      { key: 'lotNumber', label: 'Export / Domestic Lot No.', type: 'text', defaultValue: 'EXP-2026/04' },
      { key: 'totalBalesPacked', label: 'Total Bales Packed', type: 'number', defaultValue: 50 },
    ],
    columns: [
      { key: 'lotRange', label: 'Bale Serial Range', type: 'text', width: '130px' },
      { key: 'baleCount', label: 'No. of Bales', type: 'number' },
      { key: 'totalWeightKg', label: 'Total Weight (kg)', type: 'number', precision: 2 },
      { key: 'avgBaleWeightKg', label: 'Avg Bale Wt (kg)', type: 'number', precision: 2 },
    ],
    calculate: (formData, rows) => {
      let totalB = 0;
      let totalW = 0;
      rows.forEach(r => {
        const b = Number(r.baleCount) || 0;
        const w = Number(r.totalWeightKg) || 0;
        totalB += b;
        totalW += w;
      });
      const overallAvg = totalB > 0 ? totalW / totalB : 0;

      return {
        metrics: {
          totalBalesInSummary: totalB,
          totalWeightAccumulatedKg: Number(totalW.toFixed(2)),
          overallAverageBaleWeightKg: Number(overallAvg.toFixed(2)),
        },
        result: totalB > 0 ? 'PASS' : 'WARNING',
      };
    },
  },

  'FORM-27': {
    code: 'FORM-27',
    number: 27,
    title: 'Broad Loom Rolling – Roll Inspection After Rolling',
    department: 'Broad Loom Rolling',
    departmentCode: 'BLR',
    section: 'Rolling Machine',
    sampleUnit: 'Roll Dimensions',
    defaultRowCount: 6,
    description: 'Inspection of rolled broadloom carpet backing cloth (CBC) for roll diameter, tension, firmness, and alignment.',
    sourceStandardText: 'Standard: Telescoping ≤ 1.0 cm, Roll Firmness: High, Edge straightness: ± 0.5 cm.',
    fields: [
      { key: 'machineNo', label: 'Rolling Machine No.', type: 'text', defaultValue: 'BL-Roll-01' },
      { key: 'specifiedRollLengthMtrs', label: 'Specified Length (m)', type: 'number', defaultValue: 1000, unit: 'm' },
    ],
    columns: [
      { key: 'rollNo', label: 'Roll No.', type: 'text', width: '100px', required: true },
      { key: 'widthCm', label: 'Width (cm)', type: 'number', precision: 1 },
      { key: 'telescopingCm', label: 'Telescoping (cm)', type: 'number', precision: 1 },
      { key: 'rollHardness', label: 'Roll Hardness / Feel', type: 'select', options: ['Firm / Compact', 'Soft', 'Uneven'] },
    ],
    calculate: (formData, rows) => {
      const teles = rows.map(r => Number(r.telescopingCm) || 0);
      const maxTeles = teles.length > 0 ? Math.max(...teles) : 0;
      const softCount = rows.filter(r => r.rollHardness && r.rollHardness !== 'Firm / Compact').length;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (rows.length === 0) result = 'WARNING';
      else if (maxTeles > 1.5 || softCount > 1) result = 'FAIL';
      else if (maxTeles > 1.0 || softCount > 0) result = 'WARNING';

      return {
        metrics: {
          rollsChecked: rows.length,
          maxTelescopingCm: maxTeles,
          irregularRollsCount: softCount,
        },
        result,
      };
    },
  },

  'FORM-28': {
    code: 'FORM-28',
    number: 28,
    title: 'Broad Loom Rolling – Fabric Fault Checking',
    department: 'Broad Loom Rolling',
    departmentCode: 'BLR',
    section: 'Rolling QC Table',
    sampleUnit: 'Defects / 100 m',
    defaultRowCount: 10,
    description: 'Structured predefined defect classification: Single Broken Warp, Multiple Broken Warp, Minor Gaw, Pick Gap, Smash, Snarl, Floats, Hard Beat, Black Spot, Colour Bar. Automatically calculates Total No. of Defects and Average Faults per 100 metres.',
    sourceStandardText: 'Predefined Faults: Broken Warp, Minor Gaw, Pick Gap, Smash, Snarl, Floats, Hard Beat, Black Spot, Colour Bar. Max Faults / 100m: ≤ 15.',
    fields: [
      { key: 'totalInspectedMetres', label: 'Total Inspected Fabric Length (metres)', type: 'number', defaultValue: 500, unit: 'm', required: true },
      { key: 'maxFaultsPer100m', label: 'Standard Max Faults / 100m', type: 'number', defaultValue: 15.0 },
    ],
    columns: [
      { key: 'defectType', label: 'Defect Type', type: 'select', options: [
        'Single Broken Warp',
        'Multiple Broken Warp',
        'Minor Gaw',
        'Pick Gap',
        'Smash',
        'Snarl',
        'Floats',
        'Hard Beat',
        'Black Spot',
        'Colour Bar',
      ], width: '220px', required: true },
      { key: 'defectCount', label: 'No. of Points / Count', type: 'number', required: true },
      { key: 'locations', label: 'Meter Markers / Locations', type: 'text' },
    ],
    calculate: (formData, rows) => {
      const length = Number(formData.totalInspectedMetres) || 500;
      const totalDefects = rows.reduce((s, r) => s + (Number(r.defectCount) || 0), 0);
      const faultsPer100m = length > 0 ? (totalDefects / length) * 100 : 0;
      const maxStd = Number(formData.maxFaultsPer100m) || 15.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (totalDefects === 0) result = 'PASS';
      else if (faultsPer100m > maxStd * 1.5) result = 'FAIL';
      else if (faultsPer100m > maxStd) result = 'WARNING';

      return {
        metrics: {
          totalDefectCount: totalDefects,
          inspectedLengthMtrs: length,
          faultsPer100Metres: Number(faultsPer100m.toFixed(2)),
          standardLimitPer100m: maxStd,
        },
        result,
      };
    },
  },

  'FORM-29': {
    code: 'FORM-29',
    number: 29,
    title: 'Laboratory – Oil Content Test Report',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Chemical Laboratory',
    sampleUnit: '% Oil Content',
    defaultRowCount: 4,
    description: 'Soxhlet / Rapid Oil extraction test. Oil Content % = (Weight of Extracted Oil ÷ Oven Dry Weight of Specimen) × 100.',
    sourceStandardText: 'Standard Oil Content: Hessian & Sacking: 2.5% to 3.5%; Food Grade: Max 1.25% (Requires SQC/HOD Validation).',
    fields: [
      { key: 'productCategory', label: 'Product Category', type: 'select', options: ['Standard Sacking / Hessian', 'Food Grade / Special Export', 'Raw Fiber'], defaultValue: 'Standard Sacking / Hessian' },
      { key: 'minOilPct', label: 'Min Oil %', type: 'number', defaultValue: 2.5, unit: '%' },
      { key: 'maxOilPct', label: 'Max Oil %', type: 'number', defaultValue: 3.5, unit: '%' },
    ],
    columns: [
      { key: 'sampleCode', label: 'Sample Mark / ID', type: 'text', width: '120px' },
      { key: 'dishTareWeightGms', label: 'Dish Tare Wt (g)', type: 'number', precision: 4 },
      { key: 'dishPlusOilGms', label: 'Dish + Oil Wt (g)', type: 'number', precision: 4 },
      { key: 'ovenDrySampleGms', label: 'Oven Dry Wt (g)', type: 'number', precision: 4, required: true },
      { key: 'calculatedOilPct', label: 'Oil % (Auto/Input)', type: 'number', precision: 2 },
    ],
    calculate: (formData, rows) => {
      const oilPcts: number[] = [];
      rows.forEach(r => {
        if (r.calculatedOilPct) {
          oilPcts.push(Number(r.calculatedOilPct));
        } else {
          const tare = Number(r.dishTareWeightGms) || 0;
          const gross = Number(r.dishPlusOilGms) || 0;
          const sample = Number(r.ovenDrySampleGms) || 0;
          if (sample > 0 && gross > tare) {
            oilPcts.push(((gross - tare) / sample) * 100);
          }
        }
      });

      const avg = calcMean(oilPcts);
      const minStd = Number(formData.minOilPct) || 2.5;
      const maxStd = Number(formData.maxOilPct) || 3.5;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (oilPcts.length === 0) result = 'WARNING';
      else if (avg < minStd - 0.5 || avg > maxStd + 0.5) result = 'FAIL';
      else if (avg < minStd || avg > maxStd) result = 'WARNING';

      return {
        metrics: {
          samplesTested: oilPcts.length,
          avgOilContentPct: Number(avg.toFixed(2)),
          standardMinPct: minStd,
          standardMaxPct: maxStd,
        },
        result,
      };
    },
  },

  'FORM-30': {
    code: 'FORM-30',
    number: 30,
    title: 'Laboratory – Bag / Fabric Strength Test',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Physical Testing Laboratory',
    sampleUnit: 'kgf / lbs',
    defaultRowCount: 8,
    description: 'Supports Strip and Grab test methods. Maintains Warp, Weft, and Seam strength standards dynamically.',
    sourceStandardText: 'Standard Tensile Strength: As per Quality Master (Strip/Grab). Standard Seam Strength: Min 80 kgf for B.Twill.',
    fields: [
      { key: 'testMethod', label: 'Test Method', type: 'select', options: ['Strip Test (IS 1969)', 'Grab Test (ASTM D5034)'], defaultValue: 'Strip Test (IS 1969)' },
      { key: 'standardWarpStr', label: 'Standard Warp Strength (kgf)', type: 'number', defaultValue: 150, unit: 'kgf' },
      { key: 'standardWeftStr', label: 'Standard Weft Strength (kgf)', type: 'number', defaultValue: 140, unit: 'kgf' },
      { key: 'standardSeamStr', label: 'Standard Seam Strength (kgf)', type: 'number', defaultValue: 80, unit: 'kgf' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '80px' },
      { key: 'testType', label: 'Test Direction', type: 'select', options: ['Warp Direction', 'Weft Direction', 'Side Seam', 'Bottom Seam'] },
      { key: 'breakingLoadKgf', label: 'Breaking Load (kgf)', type: 'number', precision: 1, required: true },
      { key: 'elongationPct', label: 'Elongation (%)', type: 'number', precision: 1 },
    ],
    calculate: (formData, rows) => {
      const warp = rows.filter(r => r.testType === 'Warp Direction').map(r => Number(r.breakingLoadKgf) || 0).filter(v => v > 0);
      const weft = rows.filter(r => r.testType === 'Weft Direction').map(r => Number(r.breakingLoadKgf) || 0).filter(v => v > 0);
      const seam = rows.filter(r => r.testType?.includes('Seam')).map(r => Number(r.breakingLoadKgf) || 0).filter(v => v > 0);

      const avgWarp = calcMean(warp);
      const avgWeft = calcMean(weft);
      const avgSeam = calcMean(seam);

      const stdWarp = Number(formData.standardWarpStr) || 150;
      const stdWeft = Number(formData.standardWeftStr) || 140;
      const stdSeam = Number(formData.standardSeamStr) || 80;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (rows.length === 0) result = 'WARNING';
      else if ((warp.length > 0 && avgWarp < stdWarp * 0.9) || (weft.length > 0 && avgWeft < stdWeft * 0.9) || (seam.length > 0 && avgSeam < stdSeam * 0.9)) {
        result = 'FAIL';
      } else if ((warp.length > 0 && avgWarp < stdWarp) || (weft.length > 0 && avgWeft < stdWeft) || (seam.length > 0 && avgSeam < stdSeam)) {
        result = 'WARNING';
      }

      return {
        metrics: {
          avgWarpStrengthKgf: Number(avgWarp.toFixed(1)),
          avgWeftStrengthKgf: Number(avgWeft.toFixed(1)),
          avgSeamStrengthKgf: Number(avgSeam.toFixed(1)),
          standardWarpKgf: stdWarp,
          standardWeftKgf: stdWeft,
          standardSeamKgf: stdSeam,
        },
        result,
      };
    },
  },

  'FORM-31': {
    code: 'FORM-31',
    number: 31,
    title: 'Laboratory – JBO Inspection Report',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Fuel & Oil Testing',
    sampleUnit: 'Tanker / Litres / Sp. Gr.',
    defaultRowCount: 3,
    description: 'JBO (Jute Batching Oil) tanker inspection: Challan details, compartments, dip readings, capacities, top/bottom sampling, density, temperature, gross weight, tare weight, net weight, differences and remarks.',
    sourceStandardText: 'JBO Standards: Specific Gravity @ 29.5°C: 0.850 to 0.880. Flash point: Min 66°C. Kinematic Viscosity: 18 to 28 cSt.',
    fields: [
      { key: 'tankerNo', label: 'Tanker Registration No.', type: 'text', required: true },
      { key: 'challanNo', label: 'Challan / Invoice No.', type: 'text', required: true },
      { key: 'supplierName', label: 'Supplier (IOCL / BPCL / HPCL etc.)', type: 'text', defaultValue: 'Indian Oil Corporation Ltd' },
      { key: 'challanQuantityLitres', label: 'Challan Qty (Litres)', type: 'number', defaultValue: 20000 },
      { key: 'grossWeightKg', label: 'Weighbridge Gross (kg)', type: 'number', defaultValue: 32500 },
      { key: 'tareWeightKg', label: 'Weighbridge Tare (kg)', type: 'number', defaultValue: 14200 },
    ],
    columns: [
      { key: 'compartmentNo', label: 'Compartment', type: 'text', width: '120px' },
      { key: 'dipReadingCm', label: 'Dip (cm)', type: 'number', precision: 1 },
      { key: 'temperatureC', label: 'Temp (°C)', type: 'number', precision: 1 },
      { key: 'specificGravity', label: 'Sp. Gravity @ 29.5°C', type: 'number', precision: 4, required: true },
      { key: 'waterPresence', label: 'Bottom Water Cut', type: 'select', options: ['Nil', 'Trace (<0.1%)', 'Excess Water Found'] },
    ],
    calculate: (formData, rows) => {
      const gross = Number(formData.grossWeightKg) || 0;
      const tare = Number(formData.tareWeightKg) || 0;
      const net = gross - tare;
      const gravities = rows.map(r => Number(r.specificGravity) || 0).filter(v => v > 0);
      const avgGrav = calcMean(gravities);
      const hasWater = rows.some(r => r.waterPresence === 'Excess Water Found');

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (gravities.length === 0) result = 'WARNING';
      else if (avgGrav < 0.850 || avgGrav > 0.885 || hasWater) result = 'FAIL';
      else if (avgGrav < 0.855 || avgGrav > 0.880) result = 'WARNING';

      return {
        metrics: {
          netOilWeightKg: net,
          avgSpecificGravity: Number(avgGrav.toFixed(4)),
          hasExcessWater: hasWater,
        },
        result,
      };
    },
  },

  'FORM-32': {
    code: 'FORM-32',
    number: 32,
    title: 'Laboratory – Bailing Hoop Iron Test Report',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Stores / Raw Material QC',
    sampleUnit: 'mm / g/m',
    defaultRowCount: 5,
    description: 'Hoop Iron Width, Thickness, Length, Weight and gram-per-metre testing with standard comparison.',
    sourceStandardText: 'Standard Hoop Iron: Width: 20 mm ± 0.5 mm. Thickness: 0.90 mm ± 0.05 mm. Grams per Metre: 140 to 148 g/m. Min Tensile: 45 kgf/mm².',
    fields: [
      { key: 'supplierName', label: 'Hoop Iron Supplier', type: 'text' },
      { key: 'standardWidthMm', label: 'Standard Width (mm)', type: 'number', defaultValue: 20.0, unit: 'mm' },
      { key: 'standardThicknessMm', label: 'Standard Thickness (mm)', type: 'number', defaultValue: 0.90, unit: 'mm' },
      { key: 'standardGramPerMetre', label: 'Standard g/m', type: 'number', defaultValue: 142.0, unit: 'g/m' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '80px' },
      { key: 'measuredWidthMm', label: 'Width (mm)', type: 'number', precision: 2, required: true },
      { key: 'measuredThicknessMm', label: 'Thickness (mm)', type: 'number', precision: 3, required: true },
      { key: 'sampleLengthMtr', label: 'Length (m)', type: 'number', precision: 2 },
      { key: 'sampleWeightGms', label: 'Weight (g)', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const widths = rows.map(r => Number(r.measuredWidthMm) || 0).filter(v => v > 0);
      const thicks = rows.map(r => Number(r.measuredThicknessMm) || 0).filter(v => v > 0);
      const gpms: number[] = [];
      rows.forEach(r => {
        const l = Number(r.sampleLengthMtr) || 1.0;
        const w = Number(r.sampleWeightGms) || 0;
        if (l > 0 && w > 0) gpms.push(w / l);
      });

      const avgW = calcMean(widths);
      const avgT = calcMean(thicks);
      const avgGPM = calcMean(gpms);

      const stdW = Number(formData.standardWidthMm) || 20.0;
      const stdT = Number(formData.standardThicknessMm) || 0.90;
      const stdGPM = Number(formData.standardGramPerMetre) || 142.0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (widths.length === 0) result = 'WARNING';
      else if (Math.abs(avgW - stdW) > 1.0 || Math.abs(avgT - stdT) > 0.1 || Math.abs(avgGPM - stdGPM) > 10) result = 'FAIL';
      else if (Math.abs(avgW - stdW) > 0.5 || Math.abs(avgT - stdT) > 0.05 || Math.abs(avgGPM - stdGPM) > 5) result = 'WARNING';

      return {
        metrics: {
          avgWidthMm: Number(avgW.toFixed(2)),
          avgThicknessMm: Number(avgT.toFixed(3)),
          avgGramPerMetre: Number(avgGPM.toFixed(1)),
          stdWidth: stdW,
          stdThickness: stdT,
          stdGPM: stdGPM,
        },
        result,
      };
    },
  },

  'FORM-33': {
    code: 'FORM-33',
    number: 33,
    title: 'Laboratory – T/S Powder Test Report',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Sizing Chemical Lab',
    sampleUnit: 'Viscosity & %MR',
    defaultRowCount: 4,
    description: 'Checks Tamarind Seed (T/S) Powder viscosity, moisture content, cold water solubility, and %MR Control against tolerances.',
    sourceStandardText: 'Standard T/S Powder: Moisture Content: Max 10.0%. Cold water solubles: Max 12%. Viscosity: 40–55 Redwood seconds (or Brookfield cP).',
    fields: [
      { key: 'lotSupplier', label: 'Supplier & Lot No.', type: 'text' },
      { key: 'standardMaxMoisture', label: 'Max Moisture (%)', type: 'number', defaultValue: 10.0, unit: '%' },
      { key: 'standardMinViscosity', label: 'Min Viscosity (cP)', type: 'number', defaultValue: 400 },
      { key: 'standardMaxViscosity', label: 'Max Viscosity (cP)', type: 'number', defaultValue: 700 },
    ],
    columns: [
      { key: 'sampleId', label: 'Sample ID', type: 'text', width: '120px' },
      { key: 'moisturePct', label: 'Moisture (%)', type: 'number', precision: 2, required: true },
      { key: 'viscosityCp', label: 'Viscosity (cP)', type: 'number', required: true },
      { key: 'phValue', label: 'pH Value', type: 'number', precision: 1 },
    ],
    calculate: (formData, rows) => {
      const moistures = rows.map(r => Number(r.moisturePct) || 0).filter(v => v > 0);
      const viscosities = rows.map(r => Number(r.viscosityCp) || 0).filter(v => v > 0);
      const avgM = calcMean(moistures);
      const avgV = calcMean(viscosities);

      const maxM = Number(formData.standardMaxMoisture) || 10.0;
      const minV = Number(formData.standardMinViscosity) || 400;
      const maxV = Number(formData.standardMaxViscosity) || 700;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (moistures.length === 0) result = 'WARNING';
      else if (avgM > maxM + 2.0 || avgV < minV * 0.8 || avgV > maxV * 1.25) result = 'FAIL';
      else if (avgM > maxM || avgV < minV || avgV > maxV) result = 'WARNING';

      return {
        metrics: {
          samplesTested: moistures.length,
          avgMoisturePct: Number(avgM.toFixed(2)),
          avgViscosityCp: Math.round(avgV),
        },
        result,
      };
    },
  },

  'FORM-34': {
    code: 'FORM-34',
    number: 34,
    title: 'Laboratory – Cotton Listing Test Report',
    department: 'Laboratory',
    departmentCode: 'LAB',
    section: 'Packaging Material Testing',
    sampleUnit: 'kgf Breaking Strength',
    defaultRowCount: 5,
    description: 'Cotton listing tape tensile strength checking for defined sizes and standards.',
    sourceStandardText: 'Standard Cotton Listing: Width: 25 mm ± 1 mm. Breaking Strength: Min 65 kgf.',
    fields: [
      { key: 'listingWidthMm', label: 'Listing Width (mm)', type: 'number', defaultValue: 25, unit: 'mm' },
      { key: 'standardMinStrengthKgf', label: 'Standard Min Strength (kgf)', type: 'number', defaultValue: 65, unit: 'kgf' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWidthMm', label: 'Observed Width (mm)', type: 'number', precision: 1 },
      { key: 'breakingStrengthKgf', label: 'Breaking Str (kgf)', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const strengths = rows.map(r => Number(r.breakingStrengthKgf) || 0).filter(v => v > 0);
      const avg = calcMean(strengths);
      const stdMin = Number(formData.standardMinStrengthKgf) || 65;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (strengths.length === 0) result = 'WARNING';
      else if (avg < stdMin * 0.9) result = 'FAIL';
      else if (avg < stdMin) result = 'WARNING';

      return {
        metrics: {
          samplesCount: strengths.length,
          avgBreakingStrengthKgf: Number(avg.toFixed(1)),
          standardMinKgf: stdMin,
        },
        result,
      };
    },
  },

  'FORM-35': {
    code: 'FORM-35',
    number: 35,
    title: 'Speed Checking in Different Machines',
    department: 'Machine Speed Checking',
    departmentCode: 'SPD',
    section: 'Machine Maintenance / SQC',
    sampleUnit: 'RPM / MPM',
    defaultRowCount: 8,
    description: 'Stage-specific speed checking with Machine Type, Machine No., Standard Speed, Observed Speed, unit and deviation for Card, Drawing, Spinning, and Loom sections.',
    sourceStandardText: 'Standard Speeds: Breaker Cylinder: 185 RPM; Finisher Card: 195 RPM; Spinning Flyer: 3200–3800 RPM; Looms: 160–210 PPM. Permissible deviation: ± 3.0%.',
    fields: [
      { key: 'inspectionSection', label: 'Machine Section', type: 'select', options: ['Carding', 'Drawing', 'Spinning', 'Weaving (Looms)'], defaultValue: 'Carding' },
      { key: 'tachometerNo', label: 'Stroboscope / Tachometer ID', type: 'text', defaultValue: 'TACHO-02' },
    ],
    columns: [
      { key: 'machineType', label: 'Machine Type', type: 'text', required: true },
      { key: 'machineNo', label: 'Machine / Frame No.', type: 'text', required: true },
      { key: 'speedUnit', label: 'Unit', type: 'select', options: ['RPM', 'PPM', 'MPM (m/min)'] },
      { key: 'standardSpeed', label: 'Standard Speed', type: 'number', required: true },
      { key: 'observedSpeed', label: 'Observed Speed', type: 'number', required: true },
      { key: 'deviationPct', label: 'Deviation % (Auto)', type: 'number', precision: 2 },
    ],
    calculate: (formData, rows) => {
      let failCount = 0;
      let warnCount = 0;
      let validCount = 0;

      rows.forEach(r => {
        const std = Number(r.standardSpeed) || 0;
        const obs = Number(r.observedSpeed) || 0;
        if (std > 0 && obs > 0) {
          validCount++;
          const dev = Math.abs(((obs - std) / std) * 100);
          r.deviationPct = Number((((obs - std) / std) * 100).toFixed(2));
          if (dev > 5.0) failCount++;
          else if (dev > 3.0) warnCount++;
        }
      });

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (validCount === 0) result = 'WARNING';
      else if (failCount > 0) result = 'FAIL';
      else if (warnCount > 0) result = 'WARNING';

      return {
        metrics: {
          totalMachinesChecked: validCount,
          failingMachines: failCount,
          warningMachines: warnCount,
        },
        result,
      };
    },
  },

  'FORM-36': {
    code: 'FORM-36',
    number: 36,
    title: 'Productivity-Oriented Study in Different Zones',
    department: 'Productivity Study',
    departmentCode: 'PRD',
    section: 'Productivity & Work Study',
    sampleUnit: 'Loss Minutes & % Efficiency',
    defaultRowCount: 6,
    description: 'Productivity Study for Breaker/Finisher Card, Drawing, Spinning, and Loom. Supports relevant loss factors from source document and calculates Total Loss and Utilisation/Efficiency.',
    sourceStandardText: 'Target Utilisation: Cards: ≥ 85%; Drawing: ≥ 82%; Spinning: ≥ 88%; Looms: ≥ 78%. Total Loss = Sum of Doffing, Breakdown, Material Shortage, Idle Time.',
    fields: [
      { key: 'studyZone', label: 'Study Zone', type: 'select', options: ['Breaker / Finisher Card', 'Drawing Passage', 'Spinning Frames', 'Loom Shed'], defaultValue: 'Spinning Frames' },
      { key: 'totalShiftDurationMin', label: 'Shift Duration (Minutes)', type: 'number', defaultValue: 480, required: true },
      { key: 'targetEfficiencyPct', label: 'Target Efficiency (%)', type: 'number', defaultValue: 85.0 },
    ],
    columns: [
      { key: 'machineNo', label: 'Machine / Loom No.', type: 'text', width: '120px', required: true },
      { key: 'breakdownLossMin', label: 'Mech/Elec Breakdown (min)', type: 'number' },
      { key: 'doffingLossMin', label: 'Doffing Loss (min)', type: 'number' },
      { key: 'materialLossMin', label: 'Sliver/Yarn Shortage (min)', type: 'number' },
      { key: 'operatorAbsentMin', label: 'Idle / Absent Loss (min)', type: 'number' },
    ],
    calculate: (formData, rows) => {
      const shiftMin = Number(formData.totalShiftDurationMin) || 480;
      const targetEff = Number(formData.targetEfficiencyPct) || 85.0;

      const effList: number[] = [];
      let totalLossSum = 0;

      rows.forEach(r => {
        const b = Number(r.breakdownLossMin) || 0;
        const d = Number(r.doffingLossMin) || 0;
        const m = Number(r.materialLossMin) || 0;
        const o = Number(r.operatorAbsentMin) || 0;
        const totalMachineLoss = b + d + m + o;
        totalLossSum += totalMachineLoss;

        const runMin = Math.max(0, shiftMin - totalMachineLoss);
        const eff = (runMin / shiftMin) * 100;
        effList.push(eff);
      });

      const avgEff = calcMean(effList);
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (effList.length === 0) result = 'WARNING';
      else if (avgEff < targetEff - 5.0) result = 'FAIL';
      else if (avgEff < targetEff) result = 'WARNING';

      return {
        metrics: {
          machinesStudied: effList.length,
          totalCumulativeLossMinutes: totalLossSum,
          averageEfficiencyPercent: Number(avgEff.toFixed(2)),
          targetEfficiencyPercent: targetEff,
        },
        result,
      };
    },
  },
};

export const DEPARTMENT_LIST = [
  { id: 'DEP-SEL', code: 'SEL', name: 'Selection', hod: 'B. K. Mukherjee' },
  { id: 'DEP-JSP', code: 'JSP', name: 'Jute Spreader / Softener', hod: 'P. Sengupta' },
  { id: 'DEP-CRD', code: 'CRD', name: 'Carding', hod: 'S. K. Roy' },
  { id: 'DEP-DRW', code: 'DRW', name: 'Drawing', hod: 'M. C. Ghosh' },
  { id: 'DEP-SPN', code: 'SPN', name: 'Spinning', hod: 'A. K. Banerjee' },
  { id: 'DEP-WND', code: 'WND', name: 'Winding', hod: 'D. N. Das' },
  { id: 'DEP-BMG', code: 'BMG', name: 'Beaming', hod: 'R. K. Dutta' },
  { id: 'DEP-WVG', code: 'WVG', name: 'Weaving', hod: 'P. K. Chatterjee' },
  { id: 'DEP-CAL', code: 'CAL', name: 'Calender', hod: 'N. G. Majumdar' },
  { id: 'DEP-LAP', code: 'LAP', name: 'Lapping', hod: 'T. K. Paul' },
  { id: 'DEP-CUT', code: 'CUT', name: 'Cutting', hod: 'S. N. Saha' },
  { id: 'DEP-GDN', code: 'GDN', name: 'Godown', hod: 'A. B. Bose' },
  { id: 'DEP-SSW', code: 'SSW', name: 'Sacksewing', hod: 'K. L. Sarkar' },
  { id: 'DEP-PRS', code: 'PRS', name: 'Press', hod: 'H. P. Mitra' },
  { id: 'DEP-BLR', code: 'BLR', name: 'Broad Loom Rolling', hod: 'G. C. Dey' },
  { id: 'DEP-LAB', code: 'LAB', name: 'Laboratory', hod: 'Dr. S. Bhattacharya' },
  { id: 'DEP-SPD', code: 'SPD', name: 'Machine Speed Checking', hod: 'R. N. Mondal' },
  { id: 'DEP-PRD', code: 'PRD', name: 'Productivity Study', hod: 'V. K. Sharma' },
];
