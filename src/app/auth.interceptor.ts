import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem('automacao.jwt');

  if (token && request.url.includes('db/admin/')) {
    return next(
      request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );
  }

  return next(request);
};
