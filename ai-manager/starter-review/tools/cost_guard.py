import os
from dataclasses import dataclass

@dataclass
class CostPolicy:
    max_calls_per_task: int = int(os.getenv("MAX_CALLS_PER_TASK", "8"))
    max_tokens_per_task: int = int(os.getenv("MAX_TOKENS_PER_TASK", "30000"))
    calls_used: int = 0
    tokens_estimated: int = 0

    def can_call_model(self, estimated_tokens: int) -> bool:
        if self.calls_used + 1 > self.max_calls_per_task:
            return False
        if self.tokens_estimated + estimated_tokens > self.max_tokens_per_task:
            return False
        return True

    def record_call(self, estimated_tokens: int) -> None:
        self.calls_used += 1
        self.tokens_estimated += estimated_tokens
