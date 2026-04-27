FROM python
WORKDIR /app
COPY app.py .
RUN pip install Flask redis
CMD ["python", "app.py"]