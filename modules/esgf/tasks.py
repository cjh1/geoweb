from celery import Celery
from time import sleep
from celery import task, current_task

celery = Celery('tasksdfg', broker='mongodb://localhost/celery', backend='mongodb://localhost/celery')

@celery.task
def add(x, y):
    return x + y

@celery.task
def power(x, y):
    result = x
    for i in range(1, y):
        result *= x
        sleep(1)
        current_task.update_state(state='PROGRESS',
                                   meta={'process_percent': i})
    return result


