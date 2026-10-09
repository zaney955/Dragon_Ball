import { register as registerYouthRegression } from './youth-regression.js';
import { register as registerBaseRegression } from './base-regression.js';
import { register as registerDebugInterface } from './debug-interface.js';
import { register as registerV1Regression } from './v1-regression.js';
import { register as registerV2Regression } from './v2-regression.js';
export const testModules = {
  'testing/youth-regression': registerYouthRegression,
  'testing/base-regression': registerBaseRegression,
  'testing/debug-interface': registerDebugInterface,
  'testing/v1-regression': registerV1Regression,
  'testing/v2-regression': registerV2Regression,
};
