import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CategoriesController } from './categories/categories.controller.js';

@Module({
  imports: [],
  controllers: [AppController, CategoriesController],
  providers: [AppService],
})
export class AppModule {}