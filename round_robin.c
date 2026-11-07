#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_PROCESSES 100
#define PID_LENGTH 32
#define QUEUE_CAP (MAX_PROCESSES * 2)

typedef struct {
    char pid[PID_LENGTH];
    int arrival;
    int burst;
    int remaining;
} Process;

typedef struct {
    int items[QUEUE_CAP];
    int front;
    int rear;
    int size;
} Queue;

void enqueue(Queue *q, int value) {
    q->items[q->rear] = value;
    q->rear = (q->rear + 1) % QUEUE_CAP;
    q->size++;
}

int dequeue(Queue *q) {
    int value = q->items[q->front];
    q->front = (q->front + 1) % QUEUE_CAP;
    q->size--;
    return value;
}

/* Prints the queue as a valid JSON array of strings: ["P1","P2"] */
void printQueue(Queue q, Process p[]) {
    printf("[");
    for (int i = 0; i < q.size; i++) {
        int index = (q.front + i) % QUEUE_CAP;
        printf("\"%s\"", p[q.items[index]].pid);
        if (i < q.size - 1) printf(",");
    }
    printf("]");
}

int main(void) {
    Process p[MAX_PROCESSES];
    int order[MAX_PROCESSES];   /* process indices sorted by arrival time */
    Queue q = {{0}, 0, 0, 0};

    int n, quantum;
    int currentTime = 0;
    int stepNumber = 0;
    int contextSwitches = 0;
    int firstStep = 1;
    int completedCount = 0;
    int nextArrival = 0;        /* position in order[] of next process to admit */
    char previousPid[PID_LENGTH] = "";

    if (scanf("%d", &n) != 1 || n < 1 || n > MAX_PROCESSES) {
        fprintf(stderr, "Invalid number of processes.\n");
        return 1;
    }

    for (int i = 0; i < n; i++) {
        if (scanf("%31s %d %d", p[i].pid, &p[i].arrival, &p[i].burst) != 3 ||
            p[i].arrival < 0 || p[i].burst <= 0) {
            fprintf(stderr, "Invalid process input.\n");
            return 1;
        }

        p[i].remaining = p[i].burst;

        for (int j = 0; j < i; j++) {
            if (strcmp(p[i].pid, p[j].pid) == 0) {
                fprintf(stderr, "Duplicate process ID.\n");
                return 1;
            }
        }

        order[i] = i;
    }

    if (scanf("%d", &quantum) != 1 || quantum <= 0) {
        fprintf(stderr, "Invalid time quantum.\n");
        return 1;
    }

    /* Stable insertion sort by arrival time (ties keep input order) */
    for (int i = 1; i < n; i++) {
        int key = order[i];
        int j = i - 1;
        while (j >= 0 && p[order[j]].arrival > p[key].arrival) {
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = key;
    }

    printf("{\"quantum\":%d,\"steps\":[", quantum);

    while (completedCount < n) {
        /* Admit every process that has arrived by now */
        while (nextArrival < n &&
               p[order[nextArrival]].arrival <= currentTime) {
            enqueue(&q, order[nextArrival]);
            nextArrival++;
        }

        /* CPU idle: jump the clock to the next arrival */
        if (q.size == 0) {
            currentTime = p[order[nextArrival]].arrival;
            continue;
        }

        int index = dequeue(&q);
        int duration = p[index].remaining < quantum
                       ? p[index].remaining
                       : quantum;

        int start = currentTime;
        currentTime += duration;
        p[index].remaining -= duration;

        int completed = (p[index].remaining == 0);
        int contextSwitch = (stepNumber > 0 &&
                             strcmp(previousPid, p[index].pid) != 0);

        if (contextSwitch) {
            contextSwitches++;
        }

        /* Processes that arrived during this slice go in BEFORE the
           preempted process is put back at the end of the queue */
        while (nextArrival < n &&
               p[order[nextArrival]].arrival <= currentTime) {
            enqueue(&q, order[nextArrival]);
            nextArrival++;
        }

        if (completed) {
            completedCount++;
        } else {
            enqueue(&q, index);
        }

        if (!firstStep) printf(",");
        firstStep = 0;

        printf("{");
        printf("\"pid\":\"%s\",", p[index].pid);

        if (stepNumber == 0) {
            printf("\"previousPid\":null,");
        } else {
            printf("\"previousPid\":\"%s\",", previousPid);
        }

        printf("\"contextSwitch\":%s,", contextSwitch ? "true" : "false");
        printf("\"start\":%d,", start);
        printf("\"end\":%d,", currentTime);
        printf("\"duration\":%d,", duration);
        printf("\"remaining\":%d,", p[index].remaining);
        printf("\"completed\":%s,", completed ? "true" : "false");

        if (completed) {
            printf("\"remarks\":\"Process completed\",");
        } else {
            printf("\"remarks\":\"Time quantum expired; process moved to ready queue\",");
        }

        printf("\"queue\":");
        printQueue(q, p);
        printf("}");

        strcpy(previousPid, p[index].pid);
        stepNumber++;
    }

    printf("],");

    printf("\"totalTime\":%d,", currentTime);
    printf("\"contextSwitches\":%d,", contextSwitches);

    printf("\"processes\":[");
    for (int i = 0; i < n; i++) {
        printf("{\"pid\":\"%s\",", p[i].pid);
        printf("\"arrival\":%d,", p[i].arrival);
        printf("\"burst\":%d,", p[i].burst);
        printf("\"remaining\":%d}", p[i].remaining);

        if (i < n - 1) printf(",");
    }

    printf("]}");

    return 0;
}