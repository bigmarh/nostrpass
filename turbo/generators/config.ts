import { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Package generator
  plop.setGenerator('package', {
    description: 'Create a new package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name (without @nostrpass/ prefix):',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Package description:',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'packages/{{name}}/package.json',
        templateFile: 'templates/package/package.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/tsconfig.json',
        templateFile: 'templates/package/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/src/index.ts',
        templateFile: 'templates/package/index.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/README.md',
        templateFile: 'templates/package/README.md.hbs',
      },
    ],
  });

  // App generator
  plop.setGenerator('app', {
    description: 'Create a new app',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'App name:',
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: ['next', 'vite', 'express'],
      },
    ],
    actions: function(data) {
      const actions = [];
      
      if (data?.framework === 'next') {
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/package.json',
          templateFile: 'templates/app-next/package.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/tsconfig.json',
          templateFile: 'templates/app-next/tsconfig.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/next.config.js',
          templateFile: 'templates/app-next/next.config.js.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/app/page.tsx',
          templateFile: 'templates/app-next/page.tsx.hbs',
        });
      }
      
      return actions;
    },
  });
}