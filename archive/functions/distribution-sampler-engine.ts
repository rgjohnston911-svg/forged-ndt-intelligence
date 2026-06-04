// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

var erf = function(x: number): number {
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var p = 0.3275911;

  var sign = x < 0 ? -1 : 1;
  var absX = Math.abs(x);
  var t = 1.0 / (1.0 + p * absX);

  var t2 = t * t;
  var t3 = t2 * t;
  var t4 = t3 * t;
  var t5 = t4 * t;

  var poly = a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5;
  var result = 1.0 - poly * Math.exp(-absX * absX);

  return sign * result;
};

var phi = function(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
};

var normalSample = function(mean: number, sd: number): number {
  var u1 = Math.random();
  var u2 = Math.random();
  var z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + sd * z;
};

var lognormalSample = function(mu: number, sigma: number): number {
  var u1 = Math.random();
  var u2 = Math.random();
  var z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
};

var triangularSample = function(min: number, mode: number, max: number): number {
  var u = Math.random();
  var modeNorm = (mode - min) / (max - min);

  if (u < modeNorm) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1.0 - u) * (max - min) * (max - mode));
  }
};

var uniformSample = function(min: number, max: number): number {
  return min + Math.random() * (max - min);
};

var weibullSample = function(shape: number, scale: number): number {
  var u = Math.random();
  var safU = Math.max(u, 1e-10);
  return scale * Math.pow(-Math.log(1.0 - safU), 1.0 / shape);
};

var empiricalSample = function(values: number[]): number {
  var idx = Math.floor(Math.random() * values.length);
  return values[idx];
};

var sample = function(distributionType: string, params: any, count: number): number[] {
  var samples: number[] = [];
  var i = 0;

  while (i < count) {
    var value: number = 0;

    if (distributionType === "NORMAL") {
      value = normalSample(params.mean || 0, params.sd || 1);
    } else if (distributionType === "LOGNORMAL") {
      value = lognormalSample(params.mu || 0, params.sigma || 1);
    } else if (distributionType === "TRIANGULAR") {
      value = triangularSample(params.min || 0, params.mode || 0.5, params.max || 1);
    } else if (distributionType === "UNIFORM") {
      value = uniformSample(params.min || 0, params.max || 1);
    } else if (distributionType === "WEIBULL") {
      value = weibullSample(params.shape || 2, params.scale || 1);
    } else if (distributionType === "EMPIRICAL") {
      if (params.values && params.values.length > 0) {
        value = empiricalSample(params.values);
      } else {
        value = 0;
      }
    } else if (distributionType === "FIXED") {
      value = params.value || 0;
    } else {
      value = 0;
    }

    samples.push(value);
    i = i + 1;
  }

  return samples;
};

var mean = function(values: number[]): number {
  if (values.length === 0) return 0;
  var sum = 0;
  var i = 0;
  while (i < values.length) {
    sum = sum + values[i];
    i = i + 1;
  }
  return sum / values.length;
};

var variance = function(values: number[]): number {
  if (values.length === 0) return 0;
  var m = mean(values);
  var sumSquaredDev = 0;
  var i = 0;
  while (i < values.length) {
    var dev = values[i] - m;
    sumSquaredDev = sumSquaredDev + dev * dev;
    i = i + 1;
  }
  return sumSquaredDev / values.length;
};

var standardDeviation = function(values: number[]): number {
  return Math.sqrt(variance(values));
};

var percentile = function(values: number[], p: number): number {
  if (values.length === 0) return 0;
  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var idx = Math.floor(p / 100.0 * (sorted.length - 1));
  idx = idx < 0 ? 0 : (idx >= sorted.length ? sorted.length - 1 : idx);
  return sorted[idx];
};

var skewness = function(values: number[]): number {
  if (values.length < 3) return 0;
  var m = mean(values);
  var sd = standardDeviation(values);
  if (sd === 0) return 0;

  var sumCubed = 0;
  var i = 0;
  while (i < values.length) {
    var z = (values[i] - m) / sd;
    sumCubed = sumCubed + z * z * z;
    i = i + 1;
  }

  return sumCubed / values.length;
};

var kurtosis = function(values: number[]): number {
  if (values.length < 4) return 0;
  var m = mean(values);
  var sd = standardDeviation(values);
  if (sd === 0) return 0;

  var sumFourth = 0;
  var i = 0;
  while (i < values.length) {
    var z = (values[i] - m) / sd;
    sumFourth = sumFourth + z * z * z * z;
    i = i + 1;
  }

  return sumFourth / values.length - 3.0;
};

var confidenceInterval = function(values: number[], alpha: number): any {
  if (values.length === 0) return { lower: 0, upper: 0 };

  var m = mean(values);
  var sd = standardDeviation(values);
  var n = values.length;
  var zCrit = 1.96;

  if (alpha === 0.05) {
    zCrit = 1.96;
  } else if (alpha === 0.01) {
    zCrit = 2.576;
  } else if (alpha === 0.10) {
    zCrit = 1.645;
  }

  var margin = zCrit * (sd / Math.sqrt(n));

  return {
    mean: m,
    lower: m - margin,
    upper: m + margin,
    marginOfError: margin
  };
};

var histogram = function(values: number[], binCount: number): any {
  if (values.length === 0) return { bins: [], edges: [] };

  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var minVal = sorted[0];
  var maxVal = sorted[sorted.length - 1];

  if (minVal === maxVal) {
    return {
      bins: [values.length],
      edges: [minVal, maxVal]
    };
  }

  var binWidth = (maxVal - minVal) / binCount;
  var bins: number[] = [];
  var i = 0;
  while (i < binCount) {
    bins.push(0);
    i = i + 1;
  }

  i = 0;
  while (i < sorted.length) {
    var binIdx = Math.floor((sorted[i] - minVal) / binWidth);
    if (binIdx >= binCount) binIdx = binCount - 1;
    bins[binIdx] = bins[binIdx] + 1;
    i = i + 1;
  }

  var edges: number[] = [];
  i = 0;
  while (i <= binCount) {
    edges.push(minVal + i * binWidth);
    i = i + 1;
  }

  return {
    bins: bins,
    edges: edges,
    binWidth: binWidth
  };
};

var correlationCoefficient = function(x: number[], y: number[]): number {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;

  var meanX = mean(x);
  var meanY = mean(y);
  var sdX = standardDeviation(x);
  var sdY = standardDeviation(y);

  if (sdX === 0 || sdY === 0) return 0;

  var sumProduct = 0;
  var i = 0;
  while (i < x.length) {
    sumProduct = sumProduct + ((x[i] - meanX) / sdX) * ((y[i] - meanY) / sdY);
    i = i + 1;
  }

  return sumProduct / x.length;
};

var normalCdf = function(x: number, mean_val?: number, sd_val?: number): number {
  var m = mean_val || 0;
  var s = sd_val || 1;
  return phi((x - m) / s);
};

var weibullReliability = function(t: number, shape: number, scale: number): any {
  var ratio = t / scale;
  var exponent = -Math.pow(ratio, shape);
  var reliability = Math.exp(exponent);
  var failureProbability = 1.0 - reliability;

  return {
    t: t,
    reliability: reliability,
    failureProbability: failureProbability,
    shape: shape,
    scale: scale
  };
};

var getRegistry = function(): any {
  return {
    engine: "distribution-sampler-engine",
    version: "DSE-1.0.0",
    deploy: "DEPLOY352",
    capabilities: [
      "distribution_sampling",
      "statistical_analysis",
      "uncertainty_propagation"
    ],
    distributions: [
      "NORMAL",
      "LOGNORMAL",
      "TRIANGULAR",
      "UNIFORM",
      "WEIBULL",
      "EMPIRICAL",
      "FIXED"
    ],
    statistics: [
      "mean",
      "standardDeviation",
      "variance",
      "skewness",
      "kurtosis",
      "percentiles",
      "confidenceInterval",
      "histogram",
      "correlationCoefficient"
    ]
  };
};

var computeStats = function(values: number[]): any {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      sd: 0,
      variance: 0,
      min: 0,
      max: 0,
      median: 0,
      skewness: 0,
      kurtosis: 0
    };
  }

  var m = mean(values);
  var sd = standardDeviation(values);
  var v = variance(values);
  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var minVal = sorted[0];
  var maxVal = sorted[sorted.length - 1];
  var median = percentile(values, 50);
  var skew = skewness(values);
  var kurt = kurtosis(values);

  var p5 = percentile(values, 5);
  var p25 = percentile(values, 25);
  var p75 = percentile(values, 75);
  var p95 = percentile(values, 95);

  var hist = histogram(values, 20);

  return {
    count: values.length,
    mean: m,
    standardDeviation: sd,
    variance: v,
    min: minVal,
    max: maxVal,
    median: median,
    p5: p5,
    p25: p25,
    p75: p75,
    p95: p95,
    skewness: skew,
    kurtosis: kurt,
    histogram: hist
  };
};

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  var body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  var action = body.action || "";
  var timestamp = new Date().toISOString();
  var response: any = {};

  try {
    if (action === "get_registry") {
      response = getRegistry();
    } else if (action === "sample") {
      var distributionType = body.distribution_type || "NORMAL";
      var params = body.params || {};
      var count = body.count || 1000;

      var samples_arr = sample(distributionType, params, count);
      var stats = computeStats(samples_arr);

      response = {
        deterministic: {
          samples: samples_arr,
          stats: stats
        },
        interpreted: {
          distribution_description: "Sampled from " + distributionType,
          quality_flags: samples_arr.length > 0 ? ["complete"] : ["empty"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "sample_batch") {
      var distributions = body.distributions || [];
      var batchResults: any[] = [];
      var i = 0;

      while (i < distributions.length) {
        var dist = distributions[i];
        var dType = dist.type || "NORMAL";
        var dParams = dist.params || {};
        var dCount = dist.count || 100;

        var dSamples = sample(dType, dParams, dCount);
        var dStats = computeStats(dSamples);

        batchResults.push({
          type: dType,
          samples: dSamples,
          stats: dStats
        });

        i = i + 1;
      }

      response = {
        deterministic: {
          results: batchResults
        },
        interpreted: {
          distribution_description: "Batch of " + distributions.length + " distributions",
          quality_flags: ["batch_complete"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "compute_stats") {
      var inputValues = body.values || [];
      var stats = computeStats(inputValues);

      response = {
        deterministic: {
          stats: stats
        },
        interpreted: {
          distribution_description: "Statistics computed on " + inputValues.length + " values",
          quality_flags: ["stats_complete"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "percentiles") {
      var pValues = body.values || [];
      var pRequested = body.percentiles || [5, 25, 50, 75, 95];
      var pResults: any = {};
      var j = 0;

      while (j < pRequested.length) {
        var p = pRequested[j];
        pResults[p] = percentile(pValues, p);
        j = j + 1;
      }

      response = {
        deterministic: {
          values: pResults
        },
        interpreted: {
          distribution_description: "Percentiles for " + pValues.length + " values",
          quality_flags: ["percentiles_computed"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "histogram") {
      var hValues = body.values || [];
      var hBins = body.bins || 20;
      var hist = histogram(hValues, hBins);

      response = {
        deterministic: {
          histogram: hist
        },
        interpreted: {
          distribution_description: "Histogram of " + hValues.length + " values into " + hBins + " bins",
          quality_flags: ["histogram_complete"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "correlation") {
      var xVals = body.x || [];
      var yVals = body.y || [];
      var r = correlationCoefficient(xVals, yVals);

      response = {
        deterministic: {
          correlation: r
        },
        interpreted: {
          distribution_description: "Pearson correlation between two arrays",
          quality_flags: xVals.length === yVals.length ? ["valid"] : ["length_mismatch"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "confidence_interval") {
      var ciValues = body.values || [];
      var ciAlpha = body.alpha || 0.05;
      var ci = confidenceInterval(ciValues, ciAlpha);

      response = {
        deterministic: {
          confidenceInterval: ci
        },
        interpreted: {
          distribution_description: "Confidence interval at alpha=" + ciAlpha,
          quality_flags: ["ci_computed"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "normal_cdf") {
      var cdfX = body.x || 0;
      var cdfMean = body.mean || 0;
      var cdfSd = body.sd || 1;
      var cdfResult = normalCdf(cdfX, cdfMean, cdfSd);

      response = {
        deterministic: {
          cdf: cdfResult
        },
        interpreted: {
          distribution_description: "Normal CDF at x=" + cdfX,
          quality_flags: ["cdf_computed"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else if (action === "weibull_reliability") {
      var wT = body.t || 0;
      var wShape = body.shape || 2;
      var wScale = body.scale || 1;
      var wResult = weibullReliability(wT, wShape, wScale);

      response = {
        deterministic: {
          reliability: wResult
        },
        interpreted: {
          distribution_description: "Weibull reliability function",
          quality_flags: ["reliability_computed"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    } else {
      response = {
        deterministic: {},
        interpreted: {
          distribution_description: "Unknown action",
          quality_flags: ["error"]
        },
        provenance: {
          engine: "distribution-sampler-engine",
          version: "DSE-1.0.0",
          deploy: "DEPLOY352",
          timestamp: timestamp
        }
      };
    }
  } catch (e) {
    response = {
      deterministic: {},
      interpreted: {
        distribution_description: "Error during processing",
        quality_flags: ["error"]
      },
      provenance: {
        engine: "distribution-sampler-engine",
        version: "DSE-1.0.0",
        deploy: "DEPLOY352",
        timestamp: timestamp
      }
    };
  }

  var dbWriteError = false;
  try {
    var insertPayload = {
      action: action,
      input: body,
      output: response,
      executed_at: timestamp
    };

    var dbResult = await supabase
      .from("distribution_sampler_results")
      .insert([insertPayload]);

    if (dbResult.error) {
      dbWriteError = true;
    }
  } catch (e) {
    dbWriteError = true;
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(response)
  };
};

export { handler };
