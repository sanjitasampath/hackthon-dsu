import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface MLPredictionResult {
  success: boolean;
  modelAvailable: boolean;
  classification?: {
    id: string;
    category: string;
    predictedClass: string;
    binColor: string;
    confidence: number;
    reviewRequired: boolean;
    campusDisposalGuideline: string;
    itemDescription: string;
    classProbabilities: Record<string, number>;
    inferenceTimeMs: number;
    modelType: string;
    modelDetails: string;
  };
  error?: string;
}

function getProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'ml/models/best_waste_classifier.pth')) || fs.existsSync(path.join(dir, 'ml/.venv'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function isLocalModelAvailable(): boolean {
  const rootDir = getProjectRoot();
  const modelPath = path.join(rootDir, 'ml/models/best_waste_classifier.pth');
  const pythonPath = path.join(rootDir, 'ml/.venv/bin/python');
  return fs.existsSync(modelPath) && fs.existsSync(pythonPath);
}

export function getLocalModelInfo() {
  const rootDir = getProjectRoot();
  const configPath = path.join(rootDir, 'ml/models/model_config.json');
  const metricsPath = path.join(rootDir, 'ml/models/training_metrics.json');
  const datasetPath = path.join(rootDir, 'ml/dataset_summary.json');

  let config = null;
  let metrics = null;
  let dataset = null;

  try {
    if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (fs.existsSync(metricsPath)) metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    if (fs.existsSync(datasetPath)) dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err) {
    console.error('Error reading model metadata files:', err);
  }

  return {
    isTrained: isLocalModelAvailable(),
    config,
    metrics,
    dataset
  };
}

export function predictWithLocalModel(imageBase64: string): Promise<MLPredictionResult> {
  return new Promise((resolve) => {
    const rootDir = getProjectRoot();
    const pythonPath = path.join(rootDir, 'ml/.venv/bin/python');
    const scriptPath = path.join(rootDir, 'ml/src/predict.py');
    const modelDir = path.join(rootDir, 'ml/models');

    if (!isLocalModelAvailable()) {
      return resolve({
        success: false,
        modelAvailable: false,
        error: 'Trained model checkpoint (ml/models/best_waste_classifier.pth) not found.'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const child = spawn(
      pythonPath,
      ['-u', scriptPath, '--stdin', '--model-dir', modelDir],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          PYTHONPATH: path.join(rootDir, 'ml/src')
        }
      }
    );

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('Local model prediction error, stderr:', stderrData);
        return resolve({
          success: false,
          modelAvailable: true,
          error: `Inference process failed (exit code ${code}): ${stderrData || stdoutData}`
        });
      }

      try {
        const json = JSON.parse(stdoutData.trim());
        if (!json.success) {
          return resolve({
            success: false,
            modelAvailable: true,
            error: json.error || 'Unknown inference error'
          });
        }

        const recordId = `cls_${Date.now()}`;
        resolve({
          success: true,
          modelAvailable: true,
          classification: {
            id: recordId,
            category: json.campus_category,
            predictedClass: json.predicted_class,
            binColor: json.bin_color,
            confidence: json.confidence,
            reviewRequired: json.review_required,
            campusDisposalGuideline: json.disposal_guideline,
            itemDescription: json.item_description,
            classProbabilities: json.class_probabilities,
            inferenceTimeMs: json.inference_time_ms,
            modelType: 'custom_cnn_mwcd',
            modelDetails: 'Custom MobileNetV3 trained on Merged Waste Classification Dataset (MWCD)'
          }
        });
      } catch (err: any) {
        console.error('Failed to parse Python inference JSON output:', stdoutData, err);
        resolve({
          success: false,
          modelAvailable: true,
          error: `Output parse failure: ${err.message}`
        });
      }
    });

    child.stdin.write(cleanBase64);
    child.stdin.end();
  });
}
