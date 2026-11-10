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



export async function getCurrentWeather() {
  return new Promise((resolve, reject) => {

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          // 1. Get weather
          const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto`
          );

          if (!weatherResponse.ok) {
            throw new Error("Weather API failed: " + weatherResponse.status);
          }

          const weatherData = await weatherResponse.json();
          const current = weatherData.current;

          // 2. Get city (optional)
          let city = "Unknown";
          let state = "";
          let country = "";

          try {
            const locationResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`
            );

            if (locationResponse.ok) {
              const locationData = await locationResponse.json();
              const address = locationData.address || {};

              city =
                address.city ||
                address.town ||
                address.village ||
                address.municipality ||
                address.county ||
                "Unknown";

              state = address.state || "";
              country = address.country || "";
            } else {
              console.warn("City API status:", locationResponse.status);
            }
          } catch (error) {
            console.warn("City detection unavailable:", error);
          }

          // 3. Return weather
          resolve({
            city,
            state,
            country,
            latitude,
            longitude,
            temperature: current.temperature_2m,
            feelsLike: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            condition: current.weather_code,
            timezone: weatherData.timezone
          });

        } catch (error) {
          reject(error);
        }
      },

      (error) => {
        reject(new Error("Location error: " + error.message));
      },

      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  });
}



let temperature = '';
let humidity = '';
// Load weather
const loadWeather = async () => {
  try {
    const weather = await getCurrentWeather();

    console.log("Temperature:", weather.temperature);
    console.log("Humidity:", weather.humidity);

    temperature = String(weather.temperature);
    humidity = String(weather.humidity);

  } catch (error) {
    console.error("Weather Error:", error.message);
  }
};
loadWeather()


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
    defaultRowCount: 5,
    description: '5 Morrah weight readings taken at selection. Calculates Average Weight, Range, and C.V.%.',
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
    defaultRowCount: 5,
    description: 'Tenacity checking of raw jute fiber bundles using fiber bundle tester.',
    sourceStandardText: 'Standard Bundle Strength (Tenacity): Min 22.0 g/tex. Standard C.V.%: Max 10.0%.',
    fields: [
      { key: 'baleNo', label: 'Bale / Lot No.', type: 'text', required: true },
      { key: 'juteVariety', label: 'Jute Variety (TD / W-4 etc.)', type: 'text', required: true },
      { key: 'standardTenacity', label: 'Standard Tenacity', type: 'number', defaultValue: 24.0, unit: 'g/tex' },
      { key: 'labmoisture', label: 'Jute moisture at lab', type: 'text' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'bundleWeightMg', label: 'Bundle Wt ', type: 'number', unit: 'gm' },
      { key: 'breakingLoadKg', label: 'Breaking Load', type: 'number', unit: 'gm' },
      { key: 'tenacityGtex', label: 'Tenacity', type: 'readOnly', unit: 'g/tex', precision: 2 },
    ],
    calculate: (formData, rows) => {
      const tenacities = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        const w = Number(r.bundleWeightMg);
        const l = Number(r.breakingLoadKg);
        if (w > 0 && l > 0) return r.tenacityGtex = ((l/w)*0.125).toFixed(3); // 50mm gauge length standard
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
    defaultRowCount: 5,
    hasMoistureCorrection: true,
    description: 'Sliver weight checking per 100 yds with moisture regain correction (Converted Weight = Observed Wt × (100 + Std MR)/(100 + Obs MR)).',
    sourceStandardText: 'Standard Spreader Sliver Weight: Nominal ± 3%. Standard Moisture Regain: 28% to 32%. Max C.V.%: 4.5%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 100', type: 'number', unit: 'YDS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
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
      { key: 'maxDoffingSec', label: 'Max Doffing Time', type: 'number', defaultValue: 25, unit: 'sec' },
      { key: 'feederName', label: 'Feeder Name', type: 'text', defaultValue: '', unit: '' },
      { key: 'receiverName', label: 'Receiver Name', type: 'text', defaultValue: '', unit: '' }
    ],
    columns: [
      { key: 'rollNo', label: 'Roll No.', type: 'readonly', width: '80px' },
      { key: 'totalMorrahFeed', label: 'Total Morrahs Fed', type: 'number' },
      { key: 'rollBuildingTimeMin', label: 'Roll Building Time (min)', type: 'number', precision: 2, required: true },
      { key: 'morrahFeedingRate', label: 'Morrah Feeding Rate', type: 'number', precision: 2, required: true },
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
          const frate = m / t;
          r.morrahFeedingRate = frate.toFixed(2);
        }
        if (d > 0) doffTimes.push(d);
      });
      
      const allmorrahafrate = rows .map(r => Number(r.morrahFeedingRate)) .filter(v => Number.isFinite(v) && v > 0);
      const avgmorrahafrate = calcMean(allmorrahafrate);
      
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
          avgMorrahFeedRate: Number(avgmorrahafrate.toFixed(2)),
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
    defaultRowCount: 1,
    description: 'Checks Oil-in-Water emulsion strength, specific gravity, flow rate, and application percentage.',
    sourceStandardText: 'Standard Emulsion Application: 22% to 26% on fiber. Oil content in emulsion: 18% to 22%.',
    fields: [
      { key: 'standardEmulsionPct', label: 'Standard Emulsion Application ', type: 'number', defaultValue: 24.0, unit: '%' },
      /* { key: 'standardOilPctInEmulsion', label: 'Standard Oil in Emulsion ', type: 'number', defaultValue: 20.0, unit: '%' }, */
      { key: 'temperature', label: 'Temperature ', type: 'number', defaultValue: '', unit: '°C' },
      { key: 'roomHumidity', label: 'Room Humidity ', type: 'number', defaultValue: '', unit: '%' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample / Nozzle', type: 'readonly', width: '120px' },
      { key: 'nozzleSizeEmulsion', label: 'Nozzle Size Emulsion', type: 'number', unit: '' },
      { key: 'nozzleSizeChemical', label: 'Nozzle Size Chemical', type: 'number', unit: '' },
      { key: 'machineDeliveryRpm', label: 'Machine Delivery RPM', type: 'number', unit: '', precision: 2 },
      { key: 'production', label: 'Production', type: 'number', unit: 'KG/MIN' },
      { key: 'flowRateEmulsion', label: 'Flow Rate Emulsion', type: 'number', unit: 'KG/MIN' },
      { key: 'flowRateChemical', label: 'Flow Rate Chemical', type: 'number', unit: 'KG/MIN' },
      { key: 'calApplicationEml', label: 'Calculated Application Emulsion', type: 'number', unit: '%' },
      { key: 'calApplicationChem', label: 'Calculated Application Chemical', type: 'number', unit: '%' }
    ],
    
    calculate: (formData, rows) => {
      const temp = temperature || 0;
      const hum = humidity || 0;
      formData.temperature = temp;
      formData.roomHumidity = hum;
      const apps = rows.map(r => Number(r.applicationPct) || 0).filter(v => v > 0);
      const oils = rows.map(r => Number(r.oilPct) || 0).filter(v => v > 0);
      const avgApp = calcMean(apps);
      const avgOil = calcMean(oils);
      const stdApp = Number(formData.standardEmulsionPct) || 24.0;

      rows.forEach(r => {
        if(r.machineDeliveryRpm >0) {
           r.production = (0.172*Number(r.machineDeliveryRpm)).toFixed(3);
        }
        if(r.flowRateEmulsion > 0 && r.production > 0) {
           r.calApplicationEml = ((Number(r.flowRateEmulsion)/Number(r.production))*100).toFixed(3);
        }
        if(r.flowRateChemical > 0 && r.production > 0) {
           r.calApplicationChem = ((Number(r.flowRateChemical)/Number(r.production))*100).toFixed(3);
        }
      }); 

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (apps.length === 0) result = 'WARNING';
      else if (Math.abs(avgApp - stdApp) > 3.5) result = 'FAIL';
      else if (Math.abs(avgApp - stdApp) > 2.0) result = 'WARNING';

      return {
        metrics: {
          /* avgApplicationPct: Number(avgApp.toFixed(2)),
          avgOilInEmulsionPct: Number(avgOil.toFixed(2)),
          targetApplicationPct: stdApp, */
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
    defaultRowCount: 6,
    hasMoistureCorrection: true,
    description: 'Sliver weight checking per 100 yds with moisture regain correction (Converted Weight = Observed Wt × (100 + Std MR)/(100 + Obs MR)).',
    sourceStandardText: 'Standard Spreader Sliver Weight: Nominal ± 3%. Standard Moisture Regain: 28% to 32%. Max C.V.%: 4.5%.',
    fields: [
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 100', type: 'number', unit: 'YDS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
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
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 100', type: 'number', unit: 'YDS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
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
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 100', type: 'number', unit: 'YDS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },
  /* 'FORM-09': {
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
  }, */
  'FORM-09': {
    code: 'FORM-09 A',
    number: 9,
    title: 'Inter Card – Sliver Weight Checking',
    department: 'Carding',
    departmentCode: 'CRD',
    section: 'Inter Card',
    sampleUnit: 'lbs / 100 yds',
    defaultRowCount: 5,
    hasMoistureCorrection: true,
    description: 'Inter card sliver weight checking with moisture regain conversion and C.V.%.',
    sourceStandardText: 'Standard Inter Card Sliver Wt: Nominal ± 3.0%. Standard MR: 25%. Max C.V.%: 4.5%.', 
    fields: [
      { key: 'drawingPassage', label: 'Drawing Passage', type: 'select', options: ['Drawing_1', 'Drawing_2', 'Inter Drawing', 'Draw Head'], defaultValue: 'Drawing_1' },
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/100 yds)', type: 'number', defaultValue: 34.0, unit: 'lbs' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' }
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 100', type: 'number', unit: 'YDS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
          standardSliverWeight: stdWt,
        },
        result,
      };
    },
  },
  'FORM-37': {
    code: 'FORM-09 B',
    number: 37,
    title: 'Finisher Card – Sliver Weight Checking',
    department: 'Carding',
    departmentCode: 'CRD',
    section: 'Finisher Card',
    sampleUnit: 'lbs / 1440 yds',
    defaultRowCount: 5,
    hasMoistureCorrection: true,
    description: 'Finisher card sliver weight checking with moisture regain conversion and C.V.%.',
    sourceStandardText: 'Standard Finisher Card Sliver Wt: Nominal ± 3.0%. Standard MR: 25%. Max C.V.%: 4.5%.', 
    fields: [
      { key: 'drawingPassage', label: 'Drawing Passage', type: 'select', options: ['Finisher_Drawing'], defaultValue: 'Drawing_1' },
      { key: 'standardSliverWeight', label: 'Standard Sliver Weight (lbs/1440 yds)', type: 'number', defaultValue: 34.0, unit: 'LBS' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'standardTestLength', label: 'Standard Test length', type: 'number', defaultValue:'', unit: 'YDS' },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue:'', unit: 'C' },
      { key: 'rh', label: 'Relative Humidity', type: 'number', defaultValue:'', unit: '%' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '90px' },
      { key: 'observedWeightLbs', label: 'Observed Weight ', type: 'number', unit: 'GM', precision: 2, required: true },
      { key: 'convertedWeightYds', label: 'Converted Weight in 1440 YDS', type: 'number', unit: 'LBS', precision: 2, required: true }
    ],
    calculate: (formData, rows) => {
      const stdMR = Number(formData.standardMR) || 30.0;
      const obsMR = Number(formData.observedMR) || 30.0;
      const stdWt = Number(formData.standardSliverWeight) || 34.0;
      const stdtestlth = Number(formData.standardTestLength) || 100;
      const obsWeights = rows.map(r => Number(r.observedWeightLbs) || 0).filter(v => v > 0);

      const convertedWeights = rows.map(r => {
        /* if (r.tenacityGtex) return Number(r.tenacityGtex); */
        if (stdMR > 0 && obsMR > 0) return r.convertedWeightYds = ((((.22*  r.observedWeightLbs)/stdtestlth)*(100+stdMR))/(100+obsMR)).toFixed(3); // 50mm gauge length standard
        return 0;
      }).filter(v => v > 0);

      const avgObs = calcMean(obsWeights);
      // Collect all valid converted weights
      const allconverted = rows .map(r => Number(r.convertedWeightYds)) .filter(v => Number.isFinite(v) && v > 0);
      const avgConverted = calcMean(allconverted);

      // Find maximum and minimum
      const maxMRc = allconverted.length > 0 ? Math.max(...allconverted) : 0;
      const minMRc = allconverted.length > 0 ? Math.min(...allconverted) : 0;

     /*  const pctDev = stdWt > 0 ? ((avgConverted - stdWt) / stdWt) * 100 : 0; */
      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* f (obsWeights.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5 || cv > 6.0) result = 'FAIL';
      else if (Math.abs(pctDev) > 3 || cv > 4.5) result = 'WARNING'; */

      return {
        metrics: {
          sampleCount: obsWeights.length,
          avgobservedWeightLbs: Number(avgObs.toFixed(3)),
          avgConvertedLbs: Number(avgConverted.toFixed(3)),
          ConvertedWeightRange:minMRc +' - '+maxMRc,
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
    defaultRowCount: 1,
    description: 'Yarn Count Checking. Evaluates actual count vs nominal count. Standard rule: Count must be within ±5% of nominal count.',
    sourceStandardText: 'Source Rule: Standard count must be strictly within ±5% of nominal count (lbs/spyndle).',
    fields: [
      { key: 'frameNo', label: 'Frame No.', type: 'text', required: true },
      { key: 'frameType', label: 'Frame Type', type: 'select', options: ['Ring', 'AD', 'SD'], defaultValue: 'Ring' },
      { key: 'nominalCountLbs', label: 'Nominal Yarn Count (lbs/spyndle)', type: 'number', defaultValue: 8.0, unit: 'lbs', required: true },
      { key: 'quality', label: 'Quality', type: 'select', options: ['S4_WP', 'S4_WT', 'TBAG_WP', 'TBAG_WT', 'SKG_WP', 'SKG_WT', 'VL_WP', 'VL_WT'], defaultValue: 'S4_WP' },
      { key: 'standardTestLength', label: 'Standard Test Length', type: 'select', options: ['75', '150', '225', '300', '375', '450', '525', '600','675','750'], defaultValue: '75' },
      { key: 'temperature', label: 'Temperature ', type: 'number', defaultValue: '', unit: '°C' },
      { key: 'roomHumidity', label: 'Room Humidity ', type: 'number', defaultValue: '', unit: '%' },
      { key: 'standardMR', label: 'Standard MR', type: 'number', defaultValue: 30.0, unit: '%' },
      { key: 'observedMR', label: 'Observed MR at Delivery', type: 'number', defaultValue: 29.5, unit: '%' },
      { key: 'DP', label: 'DP', type: 'number', defaultValue: '', unit: '' },
      { key: 'TP', label: 'TP', type: 'number', defaultValue: '', unit: '' },

    ],
    columns: [
      { key: 'observedWt', label: 'Observed WT',  unit: 'gm', type: 'number', precision: 2, required: true },
      { key: 'observedCountLbs', label: 'Observed Count', type: 'number', precision: 2, required: true },
      {key: 'convertedWt', label: 'Converted Weight in 14400 YDS', unit: 'LBS', type: 'number', precision: 2, required: true },
    ],
    calculate: (formData, rows) => {
      
      rows.forEach(r => {
        if(r.observedWt >0) {
           r.observedCountLbs = ((31.75/formData.standardTestLength)*r.observedWt).toFixed(3);
        }
        if(r.observedCountLbs > 0 ) {
           r.convertedWt = (Number(r.observedCountLbs)*(100+Number(formData.standardMR))/(100+Number(formData.observedMR))).toFixed(3);
        }
        
      }); 
      const nominal = Number(formData.nominalCountLbs) || 8.0;
      const counts = rows.map(r => Number(r.observedCountLbs) || 0).filter(v => v > 0);
      const avg = calcMean(counts);
      const cv = calcCV(counts);
      const pctDev = nominal > 0 ? ((avg - nominal) / nominal) * 100 : 0;

      const allf10converted = rows .map(r => Number(r.convertedWt)) .filter(v => Number.isFinite(v) && v > 0);
      const avgf10Converted = calcMean(allf10converted);
      

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (counts.length === 0) result = 'WARNING';
      else if (Math.abs(pctDev) > 5.0) result = 'FAIL'; // Source rule: ±5%
      else if (Math.abs(pctDev) > 3.0 || cv > 7.0) result = 'WARNING';

      return {
        metrics: {
          sampleCount: counts.length,
          nominalCount: nominal,
          observedCount: Number(avg.toFixed(2)),
          avgConvertedWt: Number(avgf10Converted.toFixed(2))
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
      { key: 'standardTestLength', label: 'Standard Test Length', type: 'number', defaultValue: '', unit: 'YDS' },
      { key: 'dp', label: 'DP', type: 'number', defaultValue: '', unit: '' },
      { key: 'tp', label: 'TP', type: 'number', defaultValue: '', unit: '' }
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
    defaultRowCount: 1,
    description: 'Calculates standard number of ends: Standard Ends = (Fabric Width in inches × Ends Per Inch) + Selvedge Ends.',
    sourceStandardText: 'Calculated Formula: Total Standard Ends = (Width inch × Ends/Inch) + Selvedge Ends. Permissible deviation: 0 missing ends.',
    fields: [
      { key: 'beamNo', label: 'Beam No.', type: 'text', required: true },
      { key: 'fabricWidthInch', label: 'Fabric Width (inch)', type: 'number', defaultValue: 40.0, unit: 'in', required: true },
      { key: 'beamVolume', label: 'BEAM Volume', type: 'select', options: ['1/4', '1/2', '3/4', 'FULL'] },
      { key: 'totalNoEnds', label: 'Total no of ENDS', type: 'number', defaultValue: '' },
      { key: 'actualObservedEnds', label: 'Actual Counted Ends', type: 'number', required: true },
      { key: 'standardCount', label: 'Standard Count Used', type: 'number', defaultValue: '' },
      { key: 'spoolMark', label: 'Spool Mark', type: 'text', defaultValue: '' },
    ],
    columns: [
      /* { key: 'sectionNo', label: 'Creel / Section No.', type: 'text' }, */
      { key: 'standard', label: 'Standard', type: 'number' },
      { key: 'observed', label: 'Observed', type: 'number' },
      { key: 'diffends', label: 'Difference no of ends', type: 'text' },
      { key: 'actiontaken', label: 'Action Taken', type: 'select', options: ['Rectified', 'Not Rectified', 'Put Of', 'Within Range'] },
    ],
    calculate: (formData, rows) => {
      const width = Number(formData.fabricWidthInch) || 40;
      const epi = Number(formData.endsPerInch) || 11;
      const selvedge = Number(formData.selvedgeEnds) || 24;
      const stdEnds = Math.round(width * epi + selvedge);
      const actualEnds = Number(formData.actualObservedEnds) || stdEnds;
      const totalMissing = rows.reduce((s, r) => s + (Number(r.missingEnds) || 0), 0);
      const diff = actualEnds - stdEnds;

      rows.forEach(r => {
        r.standard = formData.totalNoEnds || 0;
        r.diffends = (Number(r.standard) || 0) - (Number(r.observed) || 0);
      });

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (Math.abs(diff) > 4 || totalMissing > 4) result = 'FAIL';
      else if (Math.abs(diff) > 0 || totalMissing > 0) result = 'WARNING';

      return {
        metrics: {
          /* standardCalculatedEnds: stdEnds,
          actualCountedEnds: actualEnds,
          differenceEnds: diff,
          totalMissingEndsReported: totalMissing, */
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
    defaultRowCount: 1,
    description: 'Evaluates observed beam %MR against quality-specific ranges: Broad Loom/STB (18–22%), Hessian (16–18%), Sacking (18–20%).',
    sourceStandardText: 'Standard Moisture Regain at Beaming: Broad Loom / STB: 18.0–22.0%; Hessian: 16.0–18.0%; Sacking: 18.0–20.0%.',
    fields: [
      { key: 'fabricType', label: 'Fabric Quality Group', type: 'select', options: ['Broad Loom / STB (18–22%)', 'Hessian (16–18%)', 'Sacking (18–20%)'], defaultValue: 'Hessian (16–18%)' },
      { key: 'minMR', label: 'Min Standard %MR', type: 'number', defaultValue: 16.0, unit: '%' },
      { key: 'maxMR', label: 'Max Standard %MR', type: 'number', defaultValue: 18.0, unit: '%' },
      { key: 'beamVolume', label: 'BEAM Volume', type: 'select', options: ['1/4', '1/2', '3/4', 'FULL'] },
      { key: 'standardCount', label: 'Standard Count Used', type: 'number', defaultValue: '' },
      { key: 'spoolMark', label: 'Spool Mark', type: 'number', defaultValue: '' }
    ],
    columns: [
      { key: 'leftSideMoisture', label: 'Left side %MR', type: 'text' },
      { key: 'middle1', label: 'Middle 1 %MR', type: 'number', precision: 1 },
      { key: 'middle2', label: 'Middle 2 %MR', type: 'number', precision: 1 },
      { key: 'rightSideMoisture', label: 'Right side %MR', type: 'text' },
      { key: 'averageMR', label: 'Average %MR', type: 'number', precision: 1, required: true },
    ],
    calculate: (formData, rows) => {
      const mrs = rows.map(r => Number(r.averageMR) || 0).filter(v => v > 0);
      let avg = calcMean(mrs);
      const minStd = Number(formData.minMR) || 16.0;
      const maxStd = Number(formData.maxMR) || 18.0;

      rows.forEach(r => {
        const mrs = [
          Number(r.leftSideMoisture) || 0,
          Number(r.middle1) || 0,
          Number(r.middle2) || 0,
          Number(r.rightSideMoisture) || 0,
        ].filter(v => v > 0);

        r.averageMR = mrs.length
          ? Number((mrs.reduce((sum, v) => sum + v, 0) / mrs.length).toFixed(1))
          : 0;
          avg = r.averageMR;
      });

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
    defaultRowCount: 5,
    description: 'Post-finishing moisture regain determination across cloth pieces.',
    sourceStandardText: 'Finished Cloth Standard %MR: 14.0% to 16.0% for Hessian; 16.0% to 18.0% for Sacking.',
    fields: [
      { key: 'minAcceptableMR', label: 'Min Acceptable %MR', type: 'number', defaultValue: 14.0, unit: '%' },
      { key: 'maxAcceptableMR', label: 'Max Acceptable %MR', type: 'number', defaultValue: 16.5, unit: '%' },
    ],
    columns: [
      { key: 'moisture1', label: '%MR 1', type: 'number', precision: 1 },
      { key: 'moisture2', label: '%MR 2', type: 'number', precision: 1 },
      { key: 'moisture3', label: '%MR 3', type: 'number', precision: 1 },
      { key: 'moisture4', label: '%MR 4', type: 'number', precision: 1 },
      { key: 'moisture5', label: '%MR 5', type: 'number', precision: 1 },
      { key: 'moisture6', label: '%MR 6', type: 'number', precision: 1 },
      { key: 'moisture7', label: '%MR 7', type: 'number', precision: 1 },
      { key: 'moisture8', label: '%MR 8', type: 'number', precision: 1 },
      { key: 'moisture9', label: '%MR 9', type: 'number', precision: 1 },
      { key: 'rowmoistureAVG', label: '%MR AVG', type: 'number', precision: 1 },
    ],
    calculate: (formData, rows) => {
      
      const minStd = Number(formData.minAcceptableMR) || 14.0;
      const maxStd = Number(formData.maxAcceptableMR) || 16.5;
      rows.forEach(r => {
        const totalmrs = [
          Number(r.moisture1) || 0,
          Number(r.moisture2) || 0,
          Number(r.moisture3) || 0,
          Number(r.moisture4) || 0,
          Number(r.moisture5) || 0,
          Number(r.moisture6) || 0,
          Number(r.moisture7) || 0,
          Number(r.moisture8) || 0,
          Number(r.moisture9) || 0,
        ].filter(v => v > 0);

        r.rowmoistureAVG = totalmrs.length
          ? Number((totalmrs.reduce((sum, v) => sum + v, 0) / totalmrs.length).toFixed(1))
          : 0;
      });

      // Collect all moisture values from all rows (exclude AVG column)
    const allMrs = rows.flatMap(r => [
      Number(r.moisture1),
      Number(r.moisture2),
      Number(r.moisture3),
      Number(r.moisture4),
      Number(r.moisture5),
      Number(r.moisture6),
      Number(r.moisture7),
      Number(r.moisture8),
      Number(r.moisture9),
    ].filter(v => Number.isFinite(v) && v > 0));

    // Find maximum and minimum
    const maxMR = allMrs.length ? Math.max(...allMrs) : 0;
    const minMR = allMrs.length ? Math.min(...allMrs) : 0;

      const mrs = rows
      .map(r => Number(r.rowmoistureAVG) || 0)
      .filter(v => v > 0);

    const avg = mrs.length
      ? mrs.reduce((sum, v) => sum + v, 0) / mrs.length
      : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      if (mrs.length === 0) result = 'WARNING';
      else if (avg < minStd - 1.0 || avg > maxStd + 1.0) result = 'FAIL';
      else if (avg < minStd || avg > maxStd) result = 'WARNING';

      return {
        metrics: {
          sampleCount: mrs.length,
          avgFinishedClothMR: Number(avg.toFixed(2)),
          minAllowedMR: minStd,
          maxAllowedMR: maxStd,
          moistureRange: Number(maxMR) + ' - ' + Number(minMR)
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
      { key: 'specifiedBagLengthCm', label: 'Specified Bag Length ', type: 'number', defaultValue: 94.0, unit: 'cm', required: true },
      { key: 'toleranceCm', label: 'Permissible Tolerance (± cm)', type: 'number', defaultValue: 1.5, unit: 'cm' },
      { key: 'place', label: 'Place', type: 'select', options: ['Main Mill', 'Godown no 3', 'Godown no 1A', 'Godown no 10', 'Godown no 15'], defaultValue: '' },
       { key: 'standardCutLength', label: 'Standard Cut Length ', type: 'number', precision: 1, required: true, unit: 'inch' },
    ],
    columns: [
      { key: 'pieceNo', label: 'Cut Piece No.', type: 'readonly', width: '100px' },
      { key: 'observedCutLengthCm', label: 'Observed Length', type: 'number', precision: 1, required: true, unit: 'inch' },
    ],
    calculate: (formData, rows) => {
      const bagLen = Number(formData.specifiedBagLengthCm) || 94.0;
      const stdCut = bagLen * 2 + 10.0; // Source formula: (Bag Length × 2) + 10 cm
      const standardCutLength = formData.standardCutLength || 0
      const tol = Number(formData.toleranceCm) || 1.5;
      const lens = rows.map(r => Number(r.observedCutLengthCm) || 0).filter(v => v > 0);
      const avg = calcMean(lens);
      /* const dev = avg - stdCut; */
      const maxMRcl = lens.length > 0 ? Math.max(...lens) : 0;
      const minMRcl = lens.length > 0 ? Math.min(...lens) : 0;

      let result: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
      /* if (lens.length === 0) result = 'WARNING';
      else if (Math.abs(dev) > tol * 1.5) result = 'FAIL';
      else if (Math.abs(dev) > tol) result = 'WARNING'; */

      return {
        metrics: {
          specifiedBagLengthCm: bagLen,
          standardCuttingLengthInch: Number(standardCutLength.toFixed(2)),
          averageObservedLengthInch: Number(avg.toFixed(1)),
          observedCutLengthRange: minMRcl + ' - ' + maxMRcl
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
  title: 'Press – HY/LT Summary of Finished Bales',
  department: 'Press',
  departmentCode: 'PRS',
  section: 'Baling Press',
  sampleUnit: 'kg / Bale',
  defaultRowCount: 1,
  description: 'Calculates standard bale weight for Fabric and Bag according to source formulas.',
  sourceStandardText: '',

  fields: [
    { key: 'standardNetWeight', label: 'Standard Net WT', type: 'number', defaultValue: '0', unit: 'kg' },
    { key: 'standardMoisture', label: 'Standard Moisture', type: 'number', defaultValue: 0, unit: '%' },
    { key: 'totalNoOfBales', label: 'Total No. of Bales', type: 'number', defaultValue: 0, unit: '' }
  ],

  columns: [
    { key: 'avgObservedGrossWt', label: 'Avg Observed Gross WT', type: 'number', precision: 3, width: '100px', unit: 'kg' },
    { key: 'avgobservedTearWt', label: 'Avg Observed Tare WT', type: 'number', precision: 3, unit: 'kg' },
    { key: 'avgNetWt', label: 'Avg Net WT', type: 'number', precision: 3, unit: 'kg' },
    { key: 'avgMoisture', label: 'Avg Observed Moisture', type: 'number', precision: 2, unit: '%' },
    { key: 'avgConvertedNetWt', label: 'Avg Converted Net WT', type: 'number', precision: 3, unit: 'kg' },
    { key: 'avgConvertedHYLT', label: 'Avg Converted HY/LT', type: 'number', precision: 2, unit: '%' },
    { key: 'totalProductionWt', label: 'Total Production WT', type: 'number', precision: 3, unit: 'MT' },
    { key: 'lossGainWt', label: 'Loss/Gain WT', type: 'number', precision: 3, unit: 'MT' },
  ],

  calculate: (formData, rows) => {
    const standardNetWeight = Number(formData.standardNetWeight) || 0;
    const standardMoisture = Number(formData.standardMoisture) || 0;
    const totalNoOfBales = Number(formData.totalNoOfBales) || 0;

    let avgNetWtsummary = 0;
    let avgConvertedNetWtsummary = 0;
    let avgConvertedHYLTsummary = 0;
    let totalProductionWtsummary = 0;
    let lossGainWtsummary = 0;

    rows.forEach(r => {
      const grossWt = Number(r.avgObservedGrossWt) || 0;
      const tareWt = Number(r.avgobservedTearWt) || 0;
      const observedMoisture = Number(r.avgMoisture) || 0;

      // 1. Average Net Weight
      const netWt = grossWt - tareWt;

      // 2. Moisture Converted Net Weight
      const convertedNetWt =
        (100 + observedMoisture) !== 0
          ? netWt * ((100 + standardMoisture) / (100 + observedMoisture))
          : 0;

      // 3. Converted HY/LT Percentage
      const convertedHYLT =
        standardNetWeight > 0
          ? ((convertedNetWt - standardNetWeight) / standardNetWeight) * 100
          : 0;

      // 4. Total Production Weight (MT)
      const totalProductionWt =
        (convertedNetWt * totalNoOfBales) / 1000;

      // 5. Loss / Gain Weight (MT)
      const lossGainWt =
        ((convertedNetWt - standardNetWeight) * totalNoOfBales) / 1000;

      // Assign calculated values
      r.avgNetWt = netWt.toFixed(3);
      r.avgConvertedNetWt = convertedNetWt.toFixed(3);
      r.avgConvertedHYLT = convertedHYLT.toFixed(2);
      r.totalProductionWt = totalProductionWt.toFixed(3);
      r.lossGainWt = lossGainWt.toFixed(3);

      // Summary values
      avgNetWtsummary = netWt;
      avgConvertedNetWtsummary = convertedNetWt;
      avgConvertedHYLTsummary = convertedHYLT;
      totalProductionWtsummary = totalProductionWt;
      lossGainWtsummary = lossGainWt;
    });

    return {
      metrics: {
        avgNetWt: Number(avgNetWtsummary.toFixed(2)),
        avgConvertedNetWt: Number(avgConvertedNetWtsummary.toFixed(2)),
        avgConvertedHYLT: Number(avgConvertedHYLTsummary.toFixed(2)),
        totalProductionWt: Number(totalProductionWtsummary.toFixed(2)),
        lossGainWt: Number(lossGainWtsummary.toFixed(2)),
      },
      result: 'PASS',
    };
  },
},


  'FORM-26': {
    code: 'FORM-26',
    number: 26,
    title: 'Press – HY/LT Summary of Finished Rolls',
    department: 'Press',
    departmentCode: 'PRS',
    section: 'Press Daily Summary',
    sampleUnit: 'Rolls Summary',
    defaultRowCount: 1,
    description: 'Summary compilation of pressed bales for shift/day, verifying average HY/LT compliance across lots.',
    sourceStandardText: 'Permissible Bale Lot Deviation: Max ± 1.5% across pressed lot.',
    fields: [
      { key: 'Gsm', label: 'GSM', type: 'number', defaultValue: '0', unit: 'g/m²' },
      { key: 'width', label: 'Width', type: 'number', defaultValue: 0, unit: 'cm' },
      { key: 'rollLength', label: 'Roll length', type: 'number', defaultValue: 0, unit: 'Metre' },
      { key: 'standardRollWt', label: 'Standard Roll WT', type: 'number', defaultValue: 0, unit: 'kg' },
      { key: 'standardMoisture', label: 'Standard Moisture', type: 'number', defaultValue: 0, unit: '%' }
    ],

    columns: [
      { key: 'grosswt', label: 'Gross WT', type: 'number', precision: 3, width: '100px', unit: 'kg' },
      { key: 'tarewt', label: 'Tare WT', type: 'number', precision: 3, unit: 'kg' },
      { key: 'observedNetwt', label: 'Observed Net WT', type: 'number', precision: 3, unit: 'kg' },
      { key: 'avgObservedMoisture', label: 'Avg Observed Moisture', type: 'number', precision: 2, unit: '%' },
      { key: 'avgConvertedNetWt', label: 'Avg Converted Net WT', type: 'number', precision: 3, unit: 'kg' },
      { key: 'avgConvertedHYLT', label: 'Avg Converted HY/LT', type: 'number', precision: 2, unit: '%' },
      { key: 'totalProductionWt', label: 'Total Production WT', type: 'number', precision: 3, unit: 'MT' },
      { key: 'lossGainWt', label: 'Loss/Gain WT', type: 'number', precision: 3, unit: 'MT' },
    ],

    calculate: (formData, rows) => {
      formData.standardRollWt = (formData.Gsm * formData.width * formData.rollLength) / 100000;
      const standardRollWt = Number(formData.standardRollWt) || 0;
      const standardMoisture = Number(formData.standardMoisture) || 0;
      const rollLength = Number(formData.rollLength) || 0; 
      let avgNetWtsummary = 0;
      let avgConvertedNetWtsummary = 0;
      let avgConvertedHYLTsummary = 0;
      let totalProductionWtsummary = 0;
      let lossGainWtsummary = 0;

      rows.forEach(r => {
        const grossWt = Number(r.grosswt) || 0;
        const tareWt = Number(r.tarewt) || 0;
        const avgObservedMoisture = Number(r.avgObservedMoisture) || 0;

        // 1. Average Net Weight
        const observedNetwt = grossWt - tareWt;

        // 2. Moisture Converted Net Weight
        const convertedNetWt = observedNetwt * ((100 + standardMoisture) / (100 + avgObservedMoisture));

        // 2. Converted HY/LT Percentage
        const convertedHYLT =
          ((convertedNetWt - standardRollWt) / standardRollWt) * 100;

        // 3. Total Production Weight (MT)
        const totalProductionWt = convertedNetWt / 1000;

        // 4. Loss / Gain Weight (MT)
        const lossGainWt = (convertedNetWt - standardRollWt) / 1000;

        // Assign calculated values
        r.observedNetwt = observedNetwt.toFixed(3);
        r.avgConvertedNetWt = convertedNetWt.toFixed(3);
        r.avgConvertedHYLT = convertedHYLT.toFixed(2);
        r.totalProductionWt = totalProductionWt.toFixed(3);
        r.lossGainWt = lossGainWt.toFixed(3);

        // Summary values
        avgNetWtsummary = observedNetwt;
        avgConvertedNetWtsummary = convertedNetWt;
        avgConvertedHYLTsummary = convertedHYLT;
        totalProductionWtsummary = totalProductionWt;
        lossGainWtsummary = lossGainWt;
      });

      return {
        metrics: {
          avgNetWt: Number(avgNetWtsummary.toFixed(2)),
          avgConvertedNetWt: Number(avgConvertedNetWtsummary.toFixed(2)),
          avgConvertedHYLT: Number(avgConvertedHYLTsummary.toFixed(2)),
          totalProductionWt: Number(totalProductionWtsummary.toFixed(2)),
          lossGainWt: Number(lossGainWtsummary.toFixed(2)),
        },
        result: 'PASS',
      };
    }
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
    defaultRowCount: 1,
    description: 'Soxhlet / Rapid Oil extraction test. Oil Content % = (Weight of Extracted Oil ÷ Oven Dry Weight of Specimen) × 100.',
    sourceStandardText: 'Standard Oil Content: Hessian & Sacking: 2.5% to 3.5%; Food Grade: Max 1.25% (Requires SQC/HOD Validation).',
    fields: [
      { key: 'productCategory', label: 'Sample Tested', type: 'select', options: ['Raw Jute', 'Spd Sliver', 'B/C Sliver', 'F/C Sliver', 'Drg Sliver', 'Spg Yarn', 'WDG Yarn', 'Fabric', 'SEWING Yarn'], defaultValue: 'Raw Jute' },
      { key: 'productCategory', label: 'Sample Tested', type: 'select', options: ['Oil Conten', 'PPM content'], defaultValue: 'Raw Jute' },
      /*  { key: 'minOilPct', label: 'Min Oil %', type: 'number', defaultValue: 2.5, unit: '%' },
      { key: 'maxOilPct', label: 'Max Oil %', type: 'number', defaultValue: 3.5, unit: '%' }, */
    ],
    columns: [
      { key: 'maxRequirment', label: 'Max Requirement', type: 'text', width: '120px' },
      { key: 'observedValue', label: 'Observed value', type: 'number', precision: 4 },
      { key: 'remarks', label: 'Remarks', type: 'text', precision: 4 }
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
          /* samplesTested: oilPcts.length,
          avgOilContentPct: Number(avg.toFixed(2)),
          standardMinPct: minStd,
          standardMaxPct: maxStd, */
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
      { key: 'Billno', label: 'Bill No & Date', type: 'text' },
      { key: 'standardWidthMm', label: 'Standard Width', type: 'number', defaultValue: 20.0, unit: 'mm' },
      { key: 'standardThicknessMm', label: 'Standard Thickness', type: 'number', defaultValue: 0.90, unit: 'mm' },
      { key: 'standardGramPerMetre', label: 'Standard', type: 'number', defaultValue: 142.0, unit: 'g/m' },
    ],
    columns: [
      { key: 'sampleNo', label: 'Sample No.', type: 'readonly', width: '80px' },
      { key: 'measuredWidthMm', label: 'Measured Width (mm)', type: 'number', precision: 2, required: true },
      { key: 'measuredThicknessMm', label: 'Measured Thickness (mm)', type: 'number', precision: 3, required: true },
      { key: 'sampleLengthMtr', label: 'Measured Length (m)', type: 'number', precision: 2 },
      { key: 'observedWeightGms', label: 'Observed Weight', type: 'number', precision: 1, required: true, unit: 'gm' },
      { key: 'observed', label: 'Observed ', type: 'number', precision: 1, required: true, unit: 'gm/m' },
    ],
    calculate: (formData, rows) => {
      const widths = rows.map(r => Number(r.measuredWidthMm) || 0).filter(v => v > 0);
      const thicks = rows.map(r => Number(r.measuredThicknessMm) || 0).filter(v => v > 0);
      const gpms: number[] = [];
      rows.forEach(r => {
        const l = Number(r.sampleLengthMtr) || 1.0;
        const w = Number(r.observedWeightGms) || 0;
        if (l > 0 && w > 0) {
          gpms.push(w / l);
          r.observed = (w / l).toFixed(3);
        }
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
          avgGramPerMetre: Number(avgGPM.toFixed(1))
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
    defaultRowCount: 1,
    description: 'Checks Tamarind Seed (T/S) Powder viscosity, moisture content, cold water solubility, and %MR Control against tolerances.',
    sourceStandardText: 'Standard T/S Powder: Moisture Content: Max 10.0%. Cold water solubles: Max 12%. Viscosity: 40–55 Redwood seconds (or Brookfield cP).',
    fields: [
      { key: 'lotSupplier', label: 'Supplier & Lot No.', type: 'text' },
      { key: 'standardMaxMoisture', label: 'Max Moisture (%)', type: 'number', defaultValue: 10.0, unit: '%' },
      { key: 'standardMinViscosity', label: 'Min Viscosity ', type: 'number', defaultValue: 400,  unit: 'RWS' },
      { key: 'standardMaxViscosity', label: 'Max Viscosity ', type: 'number', defaultValue: 700, unit: 'RWS' },
    ],
    columns: [
      { key: 'sampleId', label: 'Sample ID', type: 'text', width: '120px' },
      { key: 'moisturePct', label: 'Moisture (%)', type: 'number', precision: 2, required: true },
      { key: 'viscosityCp', label: 'Viscosity ', type: 'number', required: true, unit: 'RWS' },
      { key: 'testSolution', label: 'Test solution ', type: 'number', required: true, unit: '%' },
      { key: 'testingTemparature', label: 'Testing Temperature ', type: 'number', unit: 'C' },
      { key: 'obseredValue', label: 'Observed Value ', type: 'number'}
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
