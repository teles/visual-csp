import Alpine from 'alpinejs';
import { CspParser, CspGenerator, CspSecurityEvaluator, CspValidator } from './core';
import { CspTemplateService } from './core/CspTemplates';
import { CspQuiz } from './core/CspQuiz';
import { UrlStateManager, ClipboardService, CspReportExporter, CspExporter, CspClipperService } from './services';
import { EditorApp, ChipColorizer } from './ui';

import './style.css';

// Wire up dependencies (Dependency Inversion Principle)
const parser = new CspParser();
const generator = new CspGenerator();
const evaluator = new CspSecurityEvaluator();
const urlState = new UrlStateManager();
const clipboard = new ClipboardService();
const colorizer = new ChipColorizer();
const validator = new CspValidator();
const templateService = new CspTemplateService();
const reportExporter = new CspReportExporter();
const cspExporter = new CspExporter();
const quiz = new CspQuiz();
const cspClipper = new CspClipperService();

const editorApp = new EditorApp(
  parser,
  generator,
  evaluator,
  urlState,
  clipboard,
  colorizer,
  validator,
  templateService,
  reportExporter,
  cspExporter,
  quiz,
  cspClipper
);

// Register Alpine.js component
Alpine.data('cspEditor', () => editorApp.createAlpineData());

// Start Alpine
Alpine.start();
